// dom/range utility functions

if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.wrap = (function() {
	// str - wrapping html
	// selector - denotes the insertion point, default is <span id="insertionPoint"></span> 
	// or pass your own selector
	// returns a "templated" element with a .wrapAppend(node) method that will insert the passed node at the location marked by selection
	// subsequent calls to .wrapAppend append to the same location after the last added node
	var wrap = {},
		utils = ir.textarea.utils,
		paste = ir.textarea.paste,
		extract = ir.textarea.extract,		
		Symbols = ir.textarea.CaretRulesets.Symbols;
	
	wrap.parseWrapper = function(str, selector) {
		var d = document.createElement('div'),
			f = document.createDocumentFragment(),
			replaceTarget, appendTarget;
		d.innerHTML = str;
		
		selector = selector || "span#insertionPoint";
		
		replaceTarget = Polymer.dom(d).querySelector(selector);
		
		if(!replaceTarget)
			throw new Error(selector + " not found in wrapper " + str);
		
		appendTarget = utils.parentNode(replaceTarget);
		Polymer.dom(appendTarget).removeChild(replaceTarget);
		
		// attached to the template 
		d.wrapAppend = function(node) {
			var nodeParent = utils.parentNode(node);
			if(nodeParent)
				Polymer.dom(nodeParent).removeChild(node);
			
			Polymer.dom(appendTarget).appendChild(lastInserted = node);

			return lastInserted;
		}
		
		return d;
	}
		
	// wrap a list of _subsequent_ nodes with wrapper (see wrap.parseWrapper)
	// returns the wrapper's first child 
	// (e.g. if wrapping with <i> will return the new <i>. but if wrapping with <i>[content]</i><br> client  should track the <br> by other means)
	wrap.wrapNodes = function(nodes, wrapper) {
		var i, wrapperNode, temp = document.createElement('div'), parent, res;
		
		wrapperNode = wrap.parseWrapper(wrapper);

		parent = Polymer.dom(utils.parentNode(nodes[0]));
		
		parent.insertBefore(temp, nodes[0]);
		
		for(i = 0; i < nodes.length; i++)
			wrapperNode.wrapAppend(nodes[i]);
		
		first = wrapperNode.firstChild
		while(wrapperNode.firstChild)
			parent.insertBefore(wrapperNode.firstChild, temp);
		
		parent.removeChild(temp);
		
		return first;
	}

	// split node contents into wrap groups
	// by criteria foo, criteria defaults to Symbols.WRAPCONTAINER
	wrap.splitNodeIntoWrapGroups = function(node, top, boundaryCriteria) {
		var cn, 
			childGroups,
			groups = [[]], 
			gid = 0, 
			n, i;
		
		if(!top)
			top = node;
		
		boundaryCriteria = boundaryCriteria || Symbols.WRAPCONTAINER;
		
		cn = Polymer.dom(node).childNodes;
		
		for(i = 0; i < cn.length; i++)
		{
			n = cn[i];
			if((Symbols.TEXT(n) || Symbols.NCBLOCK(n)) && (!utils.isTransitionalElement(n) && !utils.isTransitionalElement(n.parentNode)))
				groups[gid].push(n);
			else
			if(!Symbols.NCBLOCK(n) && utils.isInLightDom(n, top))
			{
				// recursively find groups
				childGroups = wrap.splitNodeIntoWrapGroups(n, top);
				
				// if there's only one group and n is not boundary - append to current group
				if(childGroups.length == 1 && !boundaryCriteria(n))
					groups[gid].push(n);
				else
				// if there are more than 1 groups or n is a boundary, they are all new groups to be wrapped separately
				if(childGroups.length > 0)
				{
					if(!groups[gid].length)
						groups.pop();
	
					groups = groups.concat(childGroups);
					gid = groups.length;
					groups.push([]);
				}
			}
		}
		
		if(!groups[gid].length)
			groups.pop();
		
		return groups[0] && groups[0].length ? groups : [];
	}
	
	
	// 
	wrap.wrapContents = function(node, wrapper) {
		wrap.splitNodeIntoWrapGroups(node).forEach(function(g) { wrap.wrapNodes(g, wrapper); });
	}
	
	wrap.splitRangeIntoWrapGroups = function(range, wrapper) {
		//var extractRes = extract.extractContents(range.startPosition, range.endPosition, { delete : true });
		var sContainer, eContainer, sHanging, eHanging, n;
		
		sContainer = utils.getNonCustomContainer(range.startPosition.container, top, true);
		eContainer = utils.getNonCustomContainer(range.endPosition.container, top, true);
		
		sHanging = utils.isHangingPos(range.startPosition, top);
		eHanging = utils.isHangingPos(range.endPosition, top);

		
	}
	
	wrap.wrapRangeSegment = function(range, wrapper, top) {
		var frag, startPath, endPath, splitRoot, dummyparagraph, src, extractRes, pos, n, done;
		
		// save path as coordinates
		startPath = utils.posToCoorinatesPos(range.startPosition, top);
		endPath = utils.posToCoorinatesPos(range.endPosition, top);
		
		if(utils.isHangingPos(range.startPosition, top) || utils.isHangingPos(range.endPosition, top))
		{
			// find split root
			splitRoot = utils.commonContainer(range.startPosition.container, range.endPosition.container, top);
			
			// hard-extract selection up to splitRoot
			extractRes = extract.extractContents(range.startPosition, range.endPosition, { delete : true, splitRoot : splitRoot, top : top });

			// create a detached dummy paragraph
			dummyparagraph = utils.newEmptyParagraph(true);
			
			if(!extractRes)
				return;
			
			if(splitRoot != top)
				dummyparagraph.appendChild(extractRes);
			else
				while(extractRes.firstChild)
					dummyparagraph.appendChild(extractRes.firstChild);
			
			// remember path of startPos
			//dummyparagraph.appendChild(extract);
			wrap.wrapContents(dummyparagraph, wrapper);

			// put them all in a fragment
			frag = document.createDocumentFragment();
			
			while(dummyparagraph.firstChild)
				frag.appendChild(dummyparagraph.firstChild)

			console.log(utils.outerHTML(frag));

			// if wrapping bare nodes we don't want them to be merged as hanging
			pos = utils.coordinatesPosToPos(startPath, top, true, true);
			if(!utils.isNonCustomContainer(frag.firstChild) && utils.isNonCustomContainer(pos.container) && pos.offset == Polymer.dom(pos.container).childNodes.length)
				pos = { container : utils.nextNodeNonDescendant(pos.container, top, true), offset : 0 };
		
			// and paste at startPosition
			return ir.textarea.paste.pasteHtmlAtPosWithParagraphs(frag, pos, { top : top });
		}
		else
		{
			n = range.startPosition.container;
			while(!done)
			{
				wrap.wrapContents(n, wrapper);
				n = utils.nextNodeNonDescendant(n);
				
				done = n == range.endPosition.container
			}
		}
			
	
	}
	

	
	wrap.wrapRange = function(range, wrapper, top) {
		var first, last, main, 
			sHanging, eHanging, 
			sContainer, eContainer,
			sMainPos, eMainPos, 
			sMainPath, eMainPath,
			sSub, eSub, includeLast, done, nextDone, t;
		
		sContainer = utils.getNonCustomContainer(range.startPosition.container, top, true);
		eContainer = utils.getNonCustomContainer(range.endPosition.container, top, true);
		
		// process hanging parts
		
		if(sContainer == eContainer)
			return wrap.wrapRangeSegment(range, wrapper, top);

		sHanging = 	utils.isHangingPos(range.startPosition, top);
		eHanging = 	utils.isHangingPos(range.endPosition, top);
		
		sMainPos =  utils.maybeSlidePosDown(range.startPosition);
		if(sHanging)
		{
			sMainPos = utils.maybeSlidePosDown({ container : utils.nextNodeNonDescendant(sContainer), offset : 0});
			sMainPath = utils.posToCoorinatesPos(sMainPos);
			
			sMainPos = wrap.wrapRangeSegment({ startPosition : range.startPosition, endPosition : sMainPos }, wrapper, top)
		}
		
		eMainPos =  utils.maybeSlidePosDown(range.endPosition);
		if(eHanging)
		{
			eMainPos = utils.maybeSlidePosDown({ container : eContainer, offset : 0 });
			eMainPath = utils.posToCoorinatesPos(eMainPos);
			
			wrap.wrapRangeSegment({ startPosition : eMainPos, endPosition : range.endPosition }, wrapper, top)
			
			eMainPos = utils.coordinatesPosToPos(eMainPath);
		}
		//if(Polymer.dom(sContainer).nextSibling != eContainer)

		
		// process the main part (non-hanging)
		if(!(sHanging && eHanging && (Polymer.dom(sContainer).nextSibling == eContainer)))
		{
			nc = utils.nextNodeNonDescendant(sMainPos.container, top, true); //utils.nextNodeNonDescendant(sMainPos.container, top, true);
			includeLast = !utils.posToContainerEdgeHasContent(eMainPos, "forward", top);

			done = function(el) { return t != eMainPos.container && ((!includeLast && el == eContainer) || (includeLast && el == Polymer.dom(eContainer).nextSibling)) };

			while(!done(nc))
			{
				// skip transitional elements
				while(utils.isLayoutElement(nc) && !done(nc))
					nc = utils.nextNode(nc, top);
				
				sSub = { container : nc, offset : 0 };
				
				if(!done(nc))
					nc = utils.nextNodeNonDescendant(nc, top, true);
				
				//eSub = { container : nc = utils.nextNodeNonDescendant(nc, top, true), offset : 0 };
				
				// capture all non-blocks
				while(	nc && !done(nc) &&
						!utils.isNonCustomContainer(nc) && 
						(t = utils.nextNodeNonDescendant(nc, top, true)) && 
						!utils.isLayoutElement(nc) && 
						t != nc)

					nc = t;

				if(nc) {
					eSub = { container : nc, offset : 0 };
					wrap.wrapRangeSegment({ startPosition : sSub, endPosition : eSub }, wrapper, top);
				}
			}
		}
	}
	
	unwrapRange = function(range, wrapper)
	{
		
	}
	
	return wrap;

	//wrap.wrapRange()
})();

/*
	// wrap all children of n disregarding container nodes
	

*/
