if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};
window.ir.textarea.extract =
(function() {
	var utils = window.ir.textarea.utils;
	var extract = {};

	/*
		splits a node at offset

		params:

		node - the node to split
		offset - in the splitted node,
		limit - the root of the split.
	*/
	extract.splitNode = function(node, offset, limit, top) {
		var parent = Polymer.dom(limit).parentNode,
			parentOffset = utils.getChildPositionInParent(limit),
			doc = node.ownerDocument,
			left,
			leftRange = doc.createRange(), clone;

		//leftRange.setStart(parent, parentOffset);
		//leftRange.setEnd(node, offset);
		//left = leftRange.extractContents();
		
		left = extract.extractContents(
			{ container : parent, offset : parentOffset }, 
			{ container : node, offset : offset}, 
			{ delete : true, splitRoot : limit, top : top }
		);
		
		if(!left)
			return node;
	
		Polymer.dom(parent).insertBefore(left, limit);

		Polymer.dom.flush();
		
		utils.visitNodes(limit.previousSibling, function(el) {  // hard-reattach custom elements lest they lose their powers
			var h;
			if(el.is)
			{
				clone = Polymer.dom(el).cloneNode(false);
				clone.innerHTML = utils.recursiveInnerHTML(el);
				Polymer.dom(Polymer.dom(el).parentNode).insertBefore(clone, el);
				Polymer.dom(Polymer.dom(el).parentNode).removeChild(el);
				Polymer.dom.flush();
			}
		})

		//left.normalize();
		//limit.normalize();

		return limit;
	}
	
	
	extract.extractContents = function(startPos, endPos, opts) {
		var startPos, endPos, 
			starts, ends, 
			first, last, 
			sFrag, eFrag,
			sCont, eCont, takeFirst, takeLast, hangingFirst, hangingLast,
			sTarget, eTarget,
			commonAncestor, 
			extractRes, 
			b, n, p, deletes = [];
	
		startPos = utils.maybeSlidePosDown(startPos);
		endPos = utils.maybeSlidePosDown(endPos);
			
		if(utils.samePos(startPos, endPos))
			return '';

		opts = opts || {};
		del = opts.delete;
		top = opts.top || top;
		
		commonAncestor = utils.commonContainer(startPos.container, endPos.container); 

		b = extract.extractBoundaries(startPos, endPos, opts.top);

		// 1. both positions are in commonAncestor that is a text node
		if(b.commonAncestor.nodeType == 3)
		{
			if(del)
				b.last.original.textContent = b.last.remainder;
		
			return b.last.copy;
		}
		
		extractRes = document.createDocumentFragment();
		
		sSource = eSource = Polymer.dom(commonAncestor);
		sTarget = eTarget = extractRes = sSource.cloneNode(false);

		takeFirst = utils.posToContainerEdgeHasContent(startPos, "forward", opts.top);
		takeLast = utils.posToContainerEdgeHasContent(endPos, "backward", opts.top);
		hangingFirst = utils.posToContainerEdgeHasContent(startPos, "backward", opts.top);
		hangingLast = takeLast && utils.posToContainerEdgeHasContent(endPos, "forward", opts.top);
		
		// run over starts[0] -> last sibling / eFrom
		while(b.starts.length || b.ends.length)
		{
			sFrom = b.starts.shift();
			sTo = sSource == eSource ?  b.ends[0] : sSource.lastChild;

			eFrom = sSource == eSource ? sTo : eSource.firstChild;
			eTo = b.ends.shift();
			
			if(!b.first.original)
				sFrom = Polymer.dom(sFrom).nextSibling
			
			// sFrom --> end/eFrom
			if(sFrom && b.first.copy)
			{
				n = sFrom;
				if(!b.first.copy || n == b.first.original)  	// if first node is not included (as in end of text), skip first's ancestor containers
					n = Polymer.dom(sFrom).nextSibling;			// also skip if we're copying the first element itself - it's done below
				for(; n && n != sTo; n = Polymer.dom(n).nextSibling)
				{
					sTarget.appendChild(Polymer.dom(n).cloneNode(n != sFrom));
					del && (n != sFrom || !b.first.remainder) && deletes.push(n); // delete all middle containers and first only if there's no remainder
				}
				sSource = Polymer.dom(sFrom);
				if(sFrom != b.first.original)
					sTarget = Polymer.dom(sTarget).firstChild;
			}

			// eFrom --> eTo
			if(eFrom)
			{
				for(n = eFrom; n && n != b.last.original && (n != eTo || takeLast); n = n && Polymer.dom(n).nextSibling)
				{
					eTarget.appendChild(Polymer.dom(n).cloneNode(n != eTo));
					del && (n != eTo || !hangingLast) && deletes.push(n);
					if(n == eTo)
						n = null;
				}
				eSource = Polymer.dom(eTo);
				if(eTo != b.last.original)
					eTarget = Polymer.dom(sTarget).lastChild; // Polymer.dom(eTarget).lastChild;
			}
		}

		// first and last containers
		if(b.first.original && b.first.copy)
			sTarget[Polymer.dom(sTarget).firstChild ? 'insertBefore' : 'appendChild'](b.first.copy, Polymer.dom(sTarget).firstChild);
		if(b.last.original && b.last.copy)
			eTarget.appendChild(b.last.copy);
		
		sCont = utils.getNonCustomContainer(startPos.container, opts.top);
		eCont = utils.getNonCustomContainer(endPos.container, opts.top);
		
		if(commonAncestor != b.last.original)
			extractRes = utils.moveChildrenToFragment(extractRes, true);
		
		if(hangingFirst && utils.isNonCustomContainer(Polymer.dom(extractRes).firstChild))
			utils.replaceWithOwnChildren(extractRes.firstChild)
		if(hangingLast && utils.isNonCustomContainer(Polymer.dom(extractRes).lastChild))
			utils.replaceWithOwnChildren(extractRes.lastChild)

		// up to here the original dom remained intact
		if(del)
		{
			if(b.first.original)
			{				
				if(b.first.original.nodeType == 3)
					b.first.original.textContent = b.first.remainder;		
				if(!b.first.remainder)
					deletes.push(b.first.original);
			}
			if(b.last.original)
			{
				if(b.last.original.nodeType == 3)
					b.last.original.textContent = b.last.remainder;
				if(b.last.copy && !b.last.remainder)
					deletest.push(b.last.original);
			}
			deletes.reverse();
			deletes.forEach(utils.removeFromParent);
		}
		
			
		// merge if in neighbouring containers
		if(utils.parentNode(sCont) && utils.parentNode(eCont) && Polymer.dom(sCont).nextSibling == eCont)
			utils.mergeNodes(sCont, eCont);
				
		
		return extractRes;
	}
	
	extract.extractBoundaries = function(startPos, endPos, top) {
		var starts, ends, sAtText, eAtText, first, last, commonAncestor;
		
		sc = startPos.container;
		ec = endPos.container;
		so = startPos.offset;
		eo = endPos.offset;
	
		starts = utils.getElementPathFromTop(sc, top);
		ends = utils.getElementPathFromTop(ec, top);
	
		sAtText = utils.atText(startPos);
		eAtText = utils.atText(endPos);
	
		if(utils.samePos(startPos, endPos))
			return null;
	
		if(sc == ec && sAtText)
			last = {
				original : sc,
				copy : document.createTextNode(sc.textContent.slice(so, eo)),
				remainder : sc.textContent.slice(0, so) + sc.textContent.slice(eo, sc.textContent.length)
			}
		else
		{
			first = { // included by default unless at text end
				original : sc,
				copy : Polymer.dom(sc).cloneNode()
			};
			if(sAtText)
				first = { 
					original : sc, 
					copy : so < sc.textContent.length && document.createTextNode(sc.textContent.slice(so, sc.textContent.length)),
					remainder : so > 0 && sc.textContent.slice(0, so) || ''
				};
			last = {
				original : ec
			}; // excluded by default unless after text start
			if(eAtText)
				last = { 
					original : ec, 
					copy : eo > 0 && document.createTextNode(ec.textContent.slice(0, eo)),
					remainder : eo < ec.textContent.length && ec.textContent.slice(eo, ec.textContent.length) || ''
				};
		}
		
		commonAncestor = top;
		while(starts.length && starts[0] == ends[0])
		{
			starts.shift();
			ends.shift();
			commonAncestor = starts[0] == ends[0] && starts[0] || commonAncestor;
		}
		
		return { 
				starts : starts, 
				ends : ends, 
				first : first || {}, 
				last : last || {},
				commonAncestor : commonAncestor
			}
	}
	
	
	// helper to extract functions. top serves as split root.
	extract.x_extractBoundaries = function(startPos, endPos, top) {
		var sc, ec, so, eo, i, commonAncestor, extract, starts = [], ends = [], 
			sfrag, efrag, starget, etarget, first, last, sAtText, eAtText;
			
		sc = startPos.container;
		ec = endPos.container;
		so = startPos.offset;
		eo = endPos.offset;

		if(sc == ec && sc.nodeType == 3)
		{
			commonAncestor = sc;
			return 	{ 
				starts : [], 
				ends : [], 
				first : first, 
				last : {
					original : sc.textContent,
					copy : document.createTextNode(sc.textContent.slice(so, eo)),
					remainder : sc.textContent.slice(0, so) + sc.textContent.slice(eo, sc.textContent.length)
				},
				commonAncestor : sc 
			}
		}
		//
		// "normalize" start
		//
		sAtText = utils.atText(startPos);
		if(sAtText == "start")
		{
			sc = Polymer.dom(sc).parentNode;
			startPos = { container : sc, offset : 0 }
		}
		else
		if(sAtText == "end")
			first = { 
						original : sc, 
						remainder : ""
					};
		else
		if(sAtText == "middle")
			first = { 
						original : sc, 
						copy : document.createTextNode(sc.textContent.slice(so, sc.textContent.length)),
						remainder : sc.textContent.slice(0, so)
					};

		//
		// "normalize" end
		//
		eAtText = utils.atText(endPos);
		if(eAtText == "start")
			endPos = { container : ec = utils.parentNode(ec), offset : eo = utils.getChildPositionInParent(ec) }
		else
		if(eAtText == "end")
		{
			//eo = utils.getChildPositionInParent(ec) + 1;
			//ec = Polymer.dom(ec).parentNode
			startPos = { container : ec, offset : eo }

			if(sc == ec)
				first = last = 
					{ 
						original : ec, 
						copy : document.createTextNode(ec.textContent.slice(ec, eo)), 
						remainder : ec.textContent.slice(0, eo) 
					};
			else
			if(ec.nodeType == 3)
				last =  
					{ 
						original : ec, 
						copy : document.createTextNode(ec.textContent.slice(0, eo)),
						remainder : ec.textContent.slice(eo, ec.textContent.length)
					};
			else
				last = {
					original : ec
				}
		}
		else
		if(eAtText == "middle")
		{
			if(sc == ec)
				first = last = 
					{ 
						original : sc, 
						copy : document.createTextNode(sc.textContent.slice(so, eo)),
						remainder : sc.textContent.slice(0, so) + sc.textContent.slice(eo, sc.textContent.length)
					};
			else
				last = 
					{ 
						original : ec, 
						copy : document.createTextNode(ec.textContent.slice(0, eo)),
						remainder : ec.textContent.slice(eo, ec.textContent.length)
					};
		}
		else
		// ends with block
		if(!utils.canHaveChildren(ec))
			last = { original : ec };
		else
		// after last element in container
		if(!ec.childNodes[eo])
			last = { original : Polymer.dom(ec).childNodes[eo-1] };

		if(first && !first.copy)
			first.copy = Polymer.dom(first.original).cloneNode(true);
		if(last && !last.copy)
			last.copy = Polymer.dom(last.original).cloneNode(true);
		
		// collect parents
		p = sc;
		starts.push(p);
		
		if(p != top)
			while(p && (p = utils.parentNode(p)))
				starts.push(p);
		
		p = ec;
		ends.push(p);
 		while(p && (p = utils.parentNode(p)))
			ends.push(p);

		// reverse to align by tree top
		starts.reverse();
		ends.reverse();

		if(top)
		{
			i = starts.indexOf(Polymer.dom(top).parentNode);
			if(i > -1)
				starts.splice(0, i + 1);
			i = ends.indexOf(Polymer.dom(top).parentNode);
			if(i > -1)
				ends.splice(0, i + 1);
			
			if(!starts.length)
				starts.push(top);
			
			if(!ends.length)
				ends.push(top);			
		}
		
		commonAncestor = starts[0];
		
		// pop first identical elements
		while((starts.length && starts[0] != top) && starts[0] == ends[0])
		{
			commonAncestor = starts.shift();
			ends.shift();
		}
		
		return 	{ 
					starts : starts, 
					ends : ends, 
					first : first, 
					last : last, 
					commonAncestor : commonAncestor 
				}
	}
	
	extract.x_extractContents = function(_startPos, _endPos, opts) {
		var sc, ec, so, eo, i, commonContainer, extractRes, starts, ends, next,
			sfrag, efrag, starget, etarget, first, last, boundaries, commonAncestor, n, del,
			startPos = utils.clonePos(_startPos), endPos = utils.clonePos(_endPos), clone, top,
			startContainerBlock, endContainerBlock, hasContent, hasContentBefore, hasContentAfter, shouldMerge, extractEndHanging;

		startPos = utils.maybeSlidePosDown(startPos);
		endPos = utils.maybeSlidePosDown(endPos);
			
		if(utils.samePos(startPos, endPos))
			return '';

		opts = opts || {};
		del = opts.delete;
		top = opts.top || top;
		
		commonAncestor = utils.commonContainer(startPos.container, endPos.container); 

		boundaries = extract.extractBoundaries(startPos, endPos, opts.splitRoot);
		
		first = boundaries.first;
		last = boundaries.last;
		starts = boundaries.starts;
		ends = boundaries.ends;
		commonAncestor = boundaries.commonAncestor;
		
		startContainerBlock = utils.getOnlyNonCustomContainer(startPos.container, top, true);
		endContainerBlock = utils.getOnlyNonCustomContainer(endPos.container, top, true);
		
		//hasContentBefore = utils.posToContainerEdgeHasContent(startPos, "forward", top);
		//hasContentAfter = utils.posToContainerEdgeHasContent(endPos, "backward", top) && 

		extractRes = Polymer.dom(commonAncestor).cloneNode(false);

		clone = Polymer.dom(commonAncestor).cloneNode(true);
		
		starget = etarget = extractRes;
		

		// merge the leftovers unless it crosses a WHOLE container
		shouldMerge = (Polymer.dom(startContainerBlock).nextSibling == endContainerBlock && hasContentBefore && hasContentAfter);
		
		if(commonAncestor.nodeType == 3)
		{
			if(del)
				commonAncestor.textContent = last.remainder
			
			return last.copy;
		}

		if(commonAncestor.nodeType == 1)
			// we're left with the deepest common ancestor
			while(starts.length || ends.length)
			{
				sc = starts.shift();
				ec = ends.shift();
				
				sfrag = document.createDocumentFragment();
				efrag = document.createDocumentFragment();

				p = sc;
				
				// sc to end/ec
				while(p && p != ec)
				{
					next = Polymer.dom(p).nextSibling;
					if(!first || p != first.original)
					{
						n = Polymer.dom(p).cloneNode(!first || p != sc);
						sfrag.appendChild(n);
						
						if(del && (p != sc || !hasContentBefore))
						{
							Polymer.dom(Polymer.dom(p).parentNode).removeChild(p); // must remove explicitly or Polymer won't update
							Polymer.dom.flush();
						}
					}
					else
					{
						sfrag.appendChild(first.copy);
						if(del)
						{
							n = Polymer.dom(Polymer.dom(first.original).parentNode);
							if(first.remainder)
								first.original.textContent = first.remainder;
							else
							{
								Polymer.dom(Polymer.dom(first.original).parentNode).removeChild(first.original)
								Polymer.dom.flush();
							}
						}
					}
					p = next;
				}
			
				// start to ec
				p = p == ec ? p : Polymer.dom(Polymer.dom(ec).parentNode).firstChild;
				while(p && p != ec)
				{
					efrag.appendChild(Polymer.dom(p).cloneNode(p != sc));
					n = p;
					p = Polymer.dom(p).nextSibling;
					if(del)
					{
						Polymer.dom(Polymer.dom(n).parentNode).removeChild(n);
						Polymer.dom.flush();
					}
				}

				if(p && last && (p != last.original))
				{
					efrag.appendChild(Polymer.dom(p).cloneNode(false));
					p = Polymer.dom(p).nextSibling;				
				}
				else
				if(p && p != ec && !last && del)
					Polymer.dom(Polymer.dom(p).parentNode).removeChild(p);

				if(sfrag.childNodes.length)
					Polymer.dom(starget).appendChild(sfrag);
				if(efrag.childNodes.length)
					Polymer.dom(etarget).appendChild(efrag);

				if(sc) // move down only if needed otherwise freeze s/e-target
					starget = Polymer.dom(starget).firstChild;
				if(ends.length)
					etarget = Polymer.dom(etarget).lastChild;
			}

		if(last && last.original.nodeType == 3)
		{
			if(first && last.original == first.original)
			{
				extractRes = last.copy;
				if(del)
					if(last.remainder)
						last.original.textContent = last.remainder;
					else
					{
						Polymer.dom(Polymer.dom(last.original).parentNode).removeChild(last.original)
						Polymer.dom.flush();
					}
			}
			else
			{
				//Polymer.dom(etarget == extract ? extract : Polymer.dom(etarget).parentNode).appendChild(last.copy);
				Polymer.dom(etarget).appendChild(last.copy);
				if(del)
				{
					if(last.remainder)
						last.original.textContent = last.remainder;
					else
					{
						Polymer.dom(Polymer.dom(last.original).parentNode).removeChild(last.original)
						Polymer.dom.flush();
					}
				}
			}
		}

		if(del)
			Polymer.dom.flush();

		if(del && utils.isNonCustomContainer(startContainerBlock) && utils.isNonCustomContainer(endContainerBlock)
			&& Polymer.dom(startContainerBlock).nextSibling == endContainerBlock)
			utils.mergeNodes(startContainerBlock, endContainerBlock);

		// merge the leftovers unless it crosses a WHOLE container
		if(del && shouldMerge)
		{
			utils.mergeNodes(extractRes.firstChild, extractRes.lastChild); // we knew it from the beginning
			utils.replaceWithOwnChildren(extractRes.firstChild);
		}
		// or delete/strip start/end accordingly
		else
		{
			if(startContainerBlock != endContainerBlock && endContainerBlock)
			{
				// strip last container of extract
				extractEndHanging = !utils.isNonCustomContainer(extractRes.lastChild);
				
				if(hasContentAfter && !extractEndHanging)
					utils.replaceWithOwnChildren(extractRes.lastChild);

				// delete/strip complementary container after selection
				if(del && !hasContentAfter && endContainerBlock != top && extractEndHanging)
						utils.removeFromParent(endContainerBlock);
			}
			
			
			if(startContainerBlock)
			{
				// strip first container of extract
				if(hasContentBefore && utils.isNonCustomContainer(extractRes.firstChild))
					utils.replaceWithOwnChildren(extractRes.firstChild);

				// delete/strip complementary container before selection
				if(del && !hasContentBefore && startContainerBlock != top)
					utils.removeFromParent(startContainerBlock);
			}
		}
		
		if(commonAncestor == top)
		{
			t = document.createDocumentFragment();
			while(extractRes.firstChild)
				t.appendChild(extractRes.firstChild);
			extractRes = t;
		}

		if(del)
			Polymer.dom.flush();
			
		return extractRes;
	}

	
	return extract;
	
})();