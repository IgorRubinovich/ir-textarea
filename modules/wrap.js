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
		
		Polymer.dom.flush();
		
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
		
		if(!node)
			return [];
		
		if(!utils.canHaveChildren(node))
			return [[node]];
		
		cn = Polymer.dom(node).childNodes;
		
		for(i = 0; i < cn.length; i++)
		{
			n = cn[i];
			if((Symbols.TEXT(n) || Symbols.NCBLOCK(n)) && 
				(!Symbols.LAYOUTELEMENT(n) && !Symbols.LAYOUTELEMENT(Polymer.dom(n).parentNode && !Symbols.TRANS(n))))
				
				groups[gid].push(n);
			
			else
			if(!Symbols.TEXT(n) && !Symbols.NCBLOCK(n) && utils.isInLightDom(n, top))
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
		var extractRes = extract.extractContents(range.startPosition, range.endPosition, { delete : true });
		
		if(Symbols.WRAPCONTAINER(extract))
			extractRes.splitIntoWrapGroups(node).forEach(function(g) { wrap.wrapNodes(g, wrapper); });
		
	
	}
	
	wrap.wrapRangeSegment = function(range, wrapper, top, viaExtract) {
		var frag, startPath, endPath, splitRoot, dummyparagraph, src, extractRes, pos, n, done;
		
		// save path as coordinates
		startPath = utils.posToCoorinatesPos(range.startPosition, top);
		endPath = utils.posToCoorinatesPos(range.endPosition, top);
		
		//if(utils.isHangingPos(range.startPosition, top) || utils.isHangingPos(range.endPosition, top))
		
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
	
	wrap.wrapRange = function(range, wrapper, top) {
		var first, last, main, 
			sHanging, eHanging, 
			sContainer, eContainer,
			sMainPos, eMainPos, 
			sMainPath, eMainPath,
			sSub, eSub, includeLast, 
			sPath, ePath, index, max, EOD;

		
		EOD = Polymer.dom(top).nextSibling;
		
 		// process hanging parts

		sHanging = 	range.endPosition.container != top && utils.isHangingPos(range.startPosition, top);
		eHanging = 	range.endPosition.container != top && utils.isHangingPos(range.endPosition, top);

		sMainPos =	utils.maybeSlidePosDown(range.startPosition);
		eMainPos =	utils.maybeSlidePosDown(range.endPosition);
		
		sContainer = utils.getNonCustomContainer(sMainPos.container, top, true);
		eContainer = utils.getNonCustomContainer(eMainPos.container, top, true);
	
		if(sHanging)
		{
			if(sContainer == eContainer)
				sMainPos = range.endPosition	
			else
				sMainPos = utils.maybeSlidePosDown({ container : utils.nextNodeNonDescendant(sContainer, top, true), offset : 0});
			
			sMainPath = utils.posToCoorinatesPos(sMainPos);
			
			sMainPos = wrap.wrapRangeSegment({ startPosition : range.startPosition, endPosition : sMainPos }, wrapper, top, true)
		}
		
		if(eHanging && range.endPosition && sContainer != eContainer)
		{
			eMainPos = utils.maybeSlidePosDown({ container : eContainer, offset : 0 });
			eMainPath = utils.posToCoorinatesPos(eMainPos);
			
			wrap.wrapRangeSegment({ startPosition : eMainPos, endPosition : range.endPosition }, wrapper, top, true)
			
			if(!utils.isNonCustomContainer(eContainer))
				eContainer = utils.getNonCustomContainer(eMainPos.container, top, true);

			eMainPos = utils.coordinatesPosToPos(eMainPath);
		}

		// check whether there's main part
		n = sMainPos.container;
		if(utils.isDescendantOf(sMainPos.container, sContainer));
			n = utils.nextNodeNonDescendant(n);
		
		console.log(sMainPos.container, eMainPos.container);
		if(!utils.rangeHasContent(sMainPos, eMainPos))
			return console.log('no main part');
		
		// there's sure a main part and we are wrapping it		
		
		commonContainer = utils.commonContainer(sMainPos.container, eMainPos.container);

		utils.markBranch(eContainer, top, "__endBranch", true);

		console.log('up the hill');

		sPath = utils.getElementPathFromTop(sContainer, commonContainer, true) || [];

		t = n = sContainer;
		if(sHanging)
			t = n = utils.nextNodeNonDescendant(n, top, true);

		// up and right the tree until we're on an __endBranch node
		while(sPath.length && !n.__endBranch && t != top && n != top)
		{
			n = t = sPath.pop();
			if(sHanging)
				t = Polymer.dom(t).nextSibling;
			while(t && !t.__endBranch && t != top)
			{
				if(!(t.nodeType == 3 && utils.isLayoutElement(t))) // we do want to wrap non-text transitional elements
				{
					wrap.wrapContents(t, wrapper);
					if(!utils.isNonCustomContainer(t) && !t.is && !utils.parentNode(t))
						t = utils.parentNode(t); // when wrapping a non-container it's _replacing_ t
				}
				if(t != top)
					n = t;
				t = Polymer.dom(t).nextSibling;
			}
			//if(t)
			//	n = t;
		}
		
		// the mid-nodes
		while(n && !n.__endBranch && n != top && n != EOD)
		{
			if(!(n.nodeType == 3 && utils.isLayoutElement(n)))
				wrap.wrapContents(n, wrapper);

			if(utils.isNonCustomContainer(n)) // for containers the wrapper will go inside n, otherwise it will wrap n
				n = Polymer.dom(n).nextSibling;
			else
				n = utils.nextNodeNonDescendant(n, top, true);
		}

		console.log('down the hill')

		ePath = utils.getElementPathFromTop(eContainer, n) || [];
		
		// down the tree until we meet eContainer
		while(ePath.length && n != eContainer)
		{
			t = Polymer.dom(n).firstChild;			
			n = ePath.shift();
			while(t && !t.__endBranch)
			{
				if(!(t.nodeType == 3 && utils.isLayoutElement(t))) // we do want to wrap non-text transitional elements
					wrap.wrapContents(t, wrapper);
				t = Polymer.dom(t).nextSibling;
			}
		}
	
		if(!eHanging && utils.rangeHasContent({ container : eContainer, offset : 0 }, range.endPosition))
			wrap.wrapContents(eContainer, wrapper);
		
		utils.unmarkBranch(eContainer, top, "__endBranch");		
	}
	
	function garbage() {
		// process the main part (non-hanging)
		if(sContainer != eContainer && (!(sHanging && eHanging && Polymer.dom(sContainer).nextSibling == eContainer))) //utils.onSameBranch(Polymer.dom(sContainer).nextSibling, eContainer)))
		{
			n = sMainPos.container
			if(sHanging && utils.onSameBranch(n, sContainer))
				n = utils.nextNodeNonDescendant(sMainPos.container, top, true);
			includeLast = !utils.posToContainerEdgeHasContent(eMainPos, "forward", top);
		
			while(n && !done) //n != eContainer)
			{
				// skip layout elements
				while(n && (eContainer != n) && (utils.isLayoutElement(n) || (isDesc = utils.isDescendantOf(eContainer, n, false))))
					n = utils.nextNode(n, top);

				done = eContainer == n;
				
				if(n && (!done || includeLast))
				{
					wrap.wrapContents(n, wrapper, false)
					n = utils.nextNodeNonDescendant(n, top);
				}
			}

		}
				
	}
		
	wrap.wrapWithAttributes = function(tag,attributes){
		var r = getSelection().getRangeAt(0), cltag,
				posr = {
					startPosition : {
						container : r.startContainer,
						offset : r.startOffset
					},
					endPosition : {
						container : r.endContainer,
						offset : r.endOffset
					}
				}
			cltag = tag.replace(/^\W+\w/, '')
			wrap.normalizeWraps(posr.startPosition,posr.endPosition,tag,attributes);
			if(! wrap.detectOverlap(posr,tag))
			{
				var aString =  '';
				if(attributes && attributes['style']) astring = ' style=' + attributes['style'];
				if(attributes && attributes['class']) astring = astring + ' class=' + attributes['class'];
				
				wrap.wrapRange(posr, "<" + tag + aString +	"><span id='insertionPoint'></span></" + cltag + ">", editor);
			}
	}
    wrap.isOverlap = function(node,t,attributes){
            // potential overlap if tag matches the node's local name
        var elemOverlap = (node.localName ==t);
		// attribute overlap if attributes exist and class specifed == the class of the parent OR
		// attributes exists and style specified == the style of the parent
		var attributeOverlap = attributes && 
            ((attribute.class && attribute.class == Polymer.dom(node).parentElement.className) || 
                (attribute.style && attribute.style == Polymer.dom(node.container).parentElement.style));
        // overlap exists if we have element overlap and no attributes or if we element attribute AND attribute overlap
        return elemOverlap && !attributes || elemOverlap && attributeOverlap;
	}
	wrap.detectOverlap = function(range,tag,attributes){
		// detects overlapping wrapping elements to the range specified  based on the tag and the style/class attributes
			var startOverlap = wrap.isOverlap(range.startPosition.container ,tag,attributes);
			var endOverlap = wrap.isOverlap(range.endPosition.container,tag, attributes);
			/* Overlap None == 0
			   Overlap Start == 1
			   Overlap End == 2
				Overlap Both == 3 */
			return startOverlap + 2 * endOverlap;
		}
	wrap.buildAttribute = function(className,style){
		var a = {};
		if(style) a['style'] = style;
		if(className) a['class'] = className;
		return a ;
	}
	wrap.normalizeWraps = function(startPosition,endPosition,tag,attributes){
        var x = utils.ancestors(startPosition.container);
		if(startPosition.container != endPosition.container)
		{
            var commonParent = utils.commonContainer(startPosition.container, endPosition.container);
                
			var currentNode = startPosition.container;
            var rangeNodes = wrap.getSelectedNodes(true);
            for(rn in rangeNodes)
            {
                wrap.removeNodeWraps(rangeNodes[rn],tag,attributes);
            }
            
		}	
	}	 
    wrap.removeNodeWraps = function(currentNode,tag,attributes){
            var drillChildren = function(nodes,tag,attributes)
            {
                for(s in children)
                {
                    wrap.removeNodeWraps(children[s],tag,attributes);
                }
            }
            // is current node a match? If yes then remove
            if(wrap.isOverlap(currentNode,tag,attributes))
            {
                // hold the previousSibling since this node is being removed
                children = Polymer.dom(currentNode).childNodes;
                if(children.length)
                {
                    utils.replaceWithOwnChildren(currentNode);
                    drillChildren(children,tag,attributes);
                }
                else
                {
                    utils.removeFromParent(currentNode);
                }
            }
            else
            {
                var children = Polymer.dom(currentNode).childNodes;
                drillChildren(children,tag,attributes);
            
            }
    }
	wrap.getSelectedNodes = function(fullySelected){
        var selection = window.getSelection();
        var range = selection.getRangeAt(0);
        if(range && range.commonAncestorContainer && range.commonAncestorContainer.getElementsByTagName)
        {
            var allWithinRangeParent = range.commonAncestorContainer.getElementsByTagName("*");

            var allSelected = [];
            for (var i=0, el; el = allWithinRangeParent[i]; i++) {
              // The second parameter says to include the element 
              // even if it's not fully selected
              if (selection.containsNode(el, fullySelected) ) {
                allSelected.push(Polymer.dom(el).node);
              }
            }
            return allSelected;
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
