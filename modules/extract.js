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
			leftRange = doc.createRange(), clone,
			op = "insertBefore";

		left = extract.extractContents(
			{ container : parent, offset : parentOffset }, 
			{ container : node, offset : offset}, 
			{ delete : true, splitRoot : limit, top : top }
		);
		
		if(!left)
			return node;
		
		if(!Polymer.dom(limit).parentNode) 							// limit may be removed if e.g. we're splitting at end of text node
			limit = Polymer.dom(parent).childNodes[parentOffset]; 	// try same position
		if(!limit) 													// or if still not there
			op = "appendChild" 										// append instead of inserting parent
		
		Polymer.dom(parent)[op](left, limit);

		Polymer.dom.flush();
		
		utils.reattachCustomElements(limit.previousSibling);

		//left.normalize();
		//limit.normalize();

		return limit;
	}
	
	// extracts contents from startPos to endPos
	// startPos, endPos - range-like position objects { container : <Node>, offset : <Number> }
	// opts object properties: 
	// 		top : absolute top of extracted area (never go higher)
	// 		splitRoot : the root of the split - i.e. the highest ancestor that will be split
	//		delete : remove the contents between startPos and endPos from the source element
	//
	// return value: a copy of the content (tree segment) between startPos and endPos
	//
	// The function considers hanging start and end. A hanging fragment forms when the selection contains only a part 
	// of a paragraph (or other block-level element), see an example in the diagram:
	//  
	// paragraph ------------------------------
	// | text one in(startPos HERE) paragraph | <-- startPos causes the word "paragraph" to hang
	//  `--------------------------------------
	// paragraph ----------------------------
	// | text two in paragraph (endPos HERE)|   <-- endPos doesn't cause any hanging end because contents of paragraph two are entirely within the range
	//  `------------------------------------
	// 
	
	extract.extractContents = function(startPos, endPos, opts) {
		var startPos, endPos, 
			starts, ends, 
			first, last, 
			sFrag, eFrag,
			sCont, eCont, takeFirst, takeLast, hangingFirst, hangingLast,
			sTarget, eTarget,
			commonAncestor, 
			extractRes, 
			t, b, n, p, deletes = [], hasContent;
	
		//if(startPos.container == opts.top)
			startPos = utils.maybeSlidePosDown(startPos);
		//if(endPos.container == opts.top)
			endPos = utils.maybeSlidePosDown(endPos);
			
		if(utils.samePos(startPos, endPos))
			return '';

		opts = opts || {};
		del = opts.delete;
		top = opts.top || top;
		
		commonAncestor = utils.commonContainer(startPos.container, endPos.container, opts.top);

		b = extract.extractBoundaries(startPos, endPos, opts.top);


		takeFirst = utils.posToContainerEdgeHasContent(startPos, "forward", opts.top);
		takeLast = utils.posToContainerEdgeHasContent(endPos, "backward", opts.top);
		hangingFirst = takeFirst && utils.posToContainerEdgeHasContent(startPos, "backward", opts.top);
		hangingLast = takeLast && utils.posToContainerEdgeHasContent(endPos, "forward", opts.top);
		
		// 1. both positions are in commonAncestor that is a text node
		if(b.commonAncestor.nodeType == 3)
		{
			if(hangingFirst || hangingLast) {
				if(del)
				{
					if(b.last.remainder)
						b.last.original.textContent = b.last.remainder;
					else
						utils.removeFromParent(b.last.original)
				}

				return b.last.copy;
			}
			else
			{
				sCont = utils.getNonCustomContainer(startPos.container, opts.top);
				if(del)
					utils.removeFromParent(sCont);
				return Polymer.dom(sCont).cloneNode(true);
			}
		}
		
		extractRes = document.createDocumentFragment();
		
		sSource = eSource = Polymer.dom(b.commonAncestor);
		sTarget = eTarget = extractRes = sSource.cloneNode(false);

		// cursor between b.starts and b.ends path arrays
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
				//if(!b.first.copy || n == b.first.original)  	// if first node is not included (as at end of text), skip first's ancestor containers
				//	n = Polymer.dom(sFrom).nextSibling;			// also skip if we're copying the first element itself - it's done below
				
				if(!takeFirst || n == b.first.original)
					n = Polymer.dom(sFrom).nextSibling;

				for(; n && (n != sTo || sTo != eFrom); n = Polymer.dom(n).nextSibling)
				{
					Polymer.dom(sTarget).appendChild(Polymer.dom(n).cloneNode(n != sFrom));
					Polymer.dom.flush();
					del && (n != sFrom || !b.first.remainder) && deletes.push(n); // delete all middle containers and first only if there's no remainder
				}
				
				sSource = Polymer.dom(sFrom);
				t = Polymer.dom(sTarget).firstChild;
				if(sFrom != b.first.original && t && t.nodeType != 3)
					sTarget = t;
			}

			// eFrom --> eTo
			if(eTo)
			{
				hasContent = utils.posToContainerEdgeHasContent(endPos, "backward", eTo)
				for(n = eFrom; n && n != b.last.original && (n != eTo || hasContent); n = n && Polymer.dom(n).nextSibling)
				{
					Polymer.dom(eTarget).appendChild(Polymer.dom(n).cloneNode(n != eTo));
					Polymer.dom.flush();
					del && (n != eTo || !hangingLast) && deletes.push(n);
					if(n == eTo)
						n = null;
				}
				eSource = Polymer.dom(eTo);
				t = Polymer.dom(eTarget).lastChild;
				if(eTo != b.last.original && t && t.nodeType != 3)
					eTarget = t; // Polymer.dom(eTarget).lastChild;
			}
		}

		// first and last containers
		if(takeFirst && b.first.original && b.first.copy && b.commonAncestor != b.first.original)
			Polymer.dom(sTarget)[Polymer.dom(sTarget).firstChild ? 'insertBefore' : 'appendChild'](b.first.copy, Polymer.dom(sTarget).firstChild);
		if(takeLast && b.last.original && b.last.copy && b.commonAncestor != b.last.original)
			Polymer.dom(eTarget).appendChild(b.last.copy);
		
		sCont = utils.getNonCustomContainer(startPos.container, opts.top);
		eCont = utils.getNonCustomContainer(endPos.container, opts.top);
		
		if(b.commonAncestor != b.last.original && (!extractRes || b.commonAncestor == opts.top || sCont == eCont || utils.isTransitionalElement(b.commonAncestor)))
			extractRes = utils.moveChildrenToFragment(extractRes, true);
		
		if(hangingFirst && utils.isNonCustomContainer(Polymer.dom(extractRes).firstChild))
			utils.replaceWithOwnChildren(extractRes.firstChild)
		if(hangingLast)
		{
			if(extractRes instanceof DocumentFragment && utils.isNonCustomContainer(Polymer.dom(extractRes).lastChild))
				utils.replaceWithOwnChildren(extractRes.lastChild)
			else
			if(utils.isNonCustomContainer(extractRes))
				extractRes = utils.childrenToFragment(extractRes);
		}
		// up to here the original dom remained intact
		if(del)
		{
			if(b.first.original)
			{				
				if(b.first.original.nodeType == 3)
					b.first.original.textContent = b.first.remainder;		
				if(takeFirst && !b.first.remainder && (!b.last.original || (utils.getNonCustomContainer(b.first.original) != utils.getNonCustomContainer(b.last.original))))
					deletes.push(b.first.original);
			}
			if(b.last.original)
			{
				if(b.last.original.nodeType == 3)
					b.last.original.textContent = b.last.remainder;
				if(b.last.copy && !b.last.remainder)
					deletes.push(b.last.original);
			}

			if(!utils.nodeHasContent(eCont) && eCont != sCont)
				deletes.push(eCont);
			if(!utils.nodeHasContent(sCont))
				deletes.push(sCont);
			
			deletes.reverse();
			deletes.forEach(utils.removeFromParent);

			//
			// merge if start and end are in neighbouring containers and none of the containers was deleted
			if(utils.parentNode(sCont) && utils.parentNode(eCont) && Polymer.dom(sCont).nextSibling == eCont && hangingFirst && hangingLast)
				utils.mergeNodes(sCont, eCont);

				
				
		}
		
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
				copy : Polymer.dom(sc).cloneNode(true)
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
		while(starts.length && starts[0] == ends[0]) // && !(starts[0] == sc && utils.canHaveChildren(sc) && so == 0))
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
	

	


	
	return extract;
	
})();