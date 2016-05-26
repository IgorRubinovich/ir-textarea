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
	extract.splitNode = function(node, offset, limit) {
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
			{ delete : true, splitRoot : limit }
		);
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

		left.normalize();
		limit.normalize();

		return limit;
	}
	
	
	// helper to extract functions. top serves as split root.
	extract.extractBoundaries = function(startPos, endPos, top) {
		var sc, ec, so, eo, i, commonAncestor, extract, starts = [], ends = [], 
			sfrag, efrag, starget, etarget, first, last, sAtText, eAtText;
		
		sc = startPos.container;
		ec = endPos.container;
		so = startPos.offset;
		eo = endPos.offset;

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
			endPos = { container : ec = Polymer.dom(ec).parentNode, offset : eo = 0 }
		else
		if(eAtText == "end")
		{
			eo = utils.getChildPositionInParent(ec) + 1;
			ec = Polymer.dom(ec).parentNode
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
		
		// pop first identical elements
		while(starts.length && starts[0] == ends[0])
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
	
	extract.extractContents = function(_startPos, _endPos, opts) {
		var sc, ec, so, eo, i, commonContainer, extractRes, starts, ends, next,
			sfrag, efrag, starget, etarget, first, last, boundaries, commonAncestor, n, del,
			startPos = _startPos, endPos = _endPos, clone,
			startContainerBlock, endContainerBlock, hasContent;

		opts = opts || {};
		del = opts.delete;
		
		commonAncestor = utils.commonContainer(startPos.container, endPos.container); 
			
		boundaries = extract.extractBoundaries(startPos, endPos, opts.splitRoot);
		
		first = boundaries.first;
		last = boundaries.last;
		starts = boundaries.starts;
		ends = boundaries.ends;
		commonAncestor = boundaries.commonAncestor;
		
		startContainerBlock = utils.getOnlyNonCustomContainer(startPos.container, commonAncestor);
		endContainerBlock = utils.getOnlyNonCustomContainer(endPos.container, commonAncestor);

		extractRes = Polymer.dom(commonAncestor).cloneNode(false);

		clone = Polymer.dom(commonAncestor).cloneNode(true);
		
		starget = etarget = extractRes;
		
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
					
					if(del)
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

		if(last)
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
			Polymer.dom.flush()

		
		if(startContainerBlock != endContainerBlock && endContainerBlock)
		{
			// end pos to its container (rest of container after range)
			hasContent = utils.rangeHasContent(endPos, { container : endContainerBlock.nextSibling, offset : 0});
			
			// update complementary container
			if(del && !hasContent)
				utils.removeFromParent(endContainerBlock);

		}
		if(startContainerBlock)
		{
			// start pos container to start pos (rest of container before range)
			hasContent = utils.rangeHasContent({ container : startContainerBlock, offset : 0}, startPos, commonAncestor);
			
			// update complementary container
			if(del && !hasContent)
				utils.removeFromParent(endContainerBlock);
		}
	
		return extractRes;
	}
	
	return extract;
	
})();