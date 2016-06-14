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

		if(frag.firstChild.is)
			utils.replaceWithOwnChildren(frag.firstChild);
		
		// and paste at startPosition
		return ir.textarea.paste.pasteHtmlAtPosWithParagraphs(frag, pos, { top : top });
	}
	
	//var criteria = function(n) { return !(n.nodeType == 3 && (utils.isLayoutElement(n) || utils.isTransitionalElement(utils.parentNode(n)))) }
	
	wrap.wrapRange = function(range, wrapper, top) {
		//wrap.getRangeContour();
		var result, criteria, operation;
		
		result = [];
		criteria = function(n) { return !(n.nodeType == 3 && (utils.isLayoutElement(n) || utils.isTransitionalElement(utils.parentNode(n)))) }
		operation = function(n) { 
			result.push(n);
			console.log(n); 
		}

		wrap.getRangeContour(range, wrapper, top, criteria, operation);
	
		result.forEach(function(t) { wrap.wrapContents(t, wrapper) });
		
	}
	
	wrap.getRangeContour = function(range, wrapper, top, criteria, operation) {
		var first, last, main, 
			sHanging, eHanging, 
			sContainer, eContainer,
			sMainPos, eMainPos, 
			sMainPath, eMainPath,
			sSub, eSub, includeLast, 
			sPath, ePath, index, max, EOD, t;
			//criteria, operation;
			
		
		EOD = Polymer.dom(top).nextSibling;

		while(!criteria(range.startPosition.container) || !utils.posToContainerEdgeHasContent(range.startPosition, "forward", top))
			range.startPosition = { container : utils.nextNodeNonDescendant(range.startPosition.container, top, true), offset : 0 };
		while(!criteria(range.endPosition.container) || !utils.posToContainerEdgeHasContent(range.endPosition, "backward", top))
		{
			t = utils.prevNode(range.endPosition.container, top); //{ container : utils.prevNode(range.endPosition.container, top, true), offset : 0 };
			range.endPosition = { container : t, offset : t.length };
		}

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
				sMainPos = range.startPosition;
			else
				sMainPos = utils.maybeSlidePosDown(range.startPosition); // utils.nextNodeNonDescendant(sContainer, top, true)
			
			sMainPath = utils.posToCoorinatesPos(sMainPos);
			
			sMainPos = wrap.wrapRangeSegment({ 
												startPosition : sMainPos, 
												endPosition : sContainer == eContainer ? range.endPosition : utils.getLastCaretPosition(sContainer)
											}, wrapper, top, true)
		}
		
		if(sContainer == eContainer)
			return;
		
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
		if(sHanging && utils.isDescendantOf(sMainPos.container, sContainer, true))
		{
			do {
				n = utils.nextNodeNonDescendant(n, top, true);
			} while(!criteria(n))
			sMainPos =	{ container : n, offset : 0 };
			sContainer = utils.getNonCustomContainer(n, top, true);
		}
		console.log(sMainPos.container, eMainPos.container);
		if(sContainer == eContainer || !utils.rangeHasContent(sMainPos, eMainPos))
			return console.log('no main part');
		
		// there's sure a main part and we are wrapping it		
		
		commonContainer = utils.commonContainer(sMainPos.container, eMainPos.container);

		utils.markBranch(sContainer, top, "__startBranch", true);
		utils.markBranch(eContainer, top, "__endBranch", true);

		console.log('up the hill');

		sPath = utils.getElementPathFromTop(sContainer, commonContainer, true) || [];

		t = n = sContainer;
		//if(sHanging)
			
		//if(!sHanging && !n.__endBranch && criteria(n))
		if((!sHanging || !(!utils.isNonCustomContainer(n) && utils.parentNode(n) == top)) && !n.__endBranch && criteria(n))
		//if((!sHanging || utils.parentNode(n) == top) && !n.__endBranch && criteria(n))
			operation(n);

		// up and right the tree until we're on an __endBranch node
		while(sPath.length && !n.__endBranch && t != top && n != top)
		{
			n = t = sPath.pop();
			if(n.__startBranch || sHanging)
				t = Polymer.dom(t).nextSibling;
			
			while(t && !t.__startBranch && !t.__endBranch && t != top)
			{
				if(criteria(t)) // we do want to wrap non-text transitional elements
					operation(t);
				if(t != top)
					n = t;
				t = Polymer.dom(t).nextSibling;
			}
		}
		
		
		// the mid-nodes
		while(n && !n.__startBranch && !n.__endBranch && n != top && n != EOD)
		{
			if(criteria(n))
				operation(n);

			n = Polymer.dom(n).nextSibling;
		}


		console.log('down the hill')

		ePath = utils.getElementPathFromTop(eContainer, n) || [];
		
		// down the tree until we meet eContainer
		while(ePath.length && n != eContainer)
		{
			t = Polymer.dom(n).firstChild;			
			n = ePath.shift();
			while(t && !t.__endBranch && t != eContainer)
			{
				if(criteria(t)) // we do want to wrap non-text transitional elements
					operation(t);

				t = Polymer.dom(t).nextSibling;
			}
		}
	
		if(!eHanging && utils.rangeHasContent({ container : eContainer, offset : 0 }, range.endPosition))
			wrap.wrapContents(eContainer, wrapper);
		
		utils.unmarkBranch(sContainer, top, "__startBranch");		
		utils.unmarkBranch(eContainer, top, "__endBranch");		
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
           
			wrap.normalizeWraps(posr,tag,attributes);
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
        
	wrap.normalizeWraps = function(range,tag,attributes){
        var rangeDetails = wrap.rangeDetails(range,tag,attributes);
        // normalize start pos container
        if(rangeDetails.sHanging)
        {
            console.log("overlapping range at start");
            var sContainerPos = rangeDetails.sAnc.indexOf(rangeDetails.sContainer);
            var newFragTop = null;
            var newFragBottom = null;
            var newFragPosition=-1;
            // determine if any parent nodes up to the first non custom container
            // need to be normalized
            for(var x = sContainerPos -1; x >= 0; x--)
            {
                if(wrap.isOverlap(rangeDetails.sAnc[x],tag,attributes))
                {
                    if(newFragPosition==-1 )
                    { // we need to persist some custom wrapper elements to the new locations
                        // so we'll build a tree of customer wrappers here.
                        newFragPosition = x +1;
                        if((x + 1) < sContainerPos)
                            newFragTop = newFragBottom = utils.newEmptyClone(rangeDetails.sAnc[x+1]);
                    }
                    
                }
                else if (newFragPosition > -1)
                {
                    if(newFragTop == null)
                    {newFragTop = newFragBottom = utils.newEmptyClone(rangeDetails.sAnc[x])}
                    else
                    {
                        newFragBottom.childNodes.appendChild(utils.newEmptyClone(rangeDetails.sAnc[x]));
                        newFragBottom = newFragBottom.childNodes[0];
                    }
                }
            }
            if(newFragTop != null)
            {
                newFragBottom.appendChild(rangeDetails.sMainPos.container)
                rangeDetails.sAnc[newFragPosition].appendChild(newFragTop)
            }
            else
            {
                var insideLeft = rangeDetails.range.startPosition.offset;
                var insideRight = rangeDetails.range.startPosition.container.length;
                if(rangeDetails.range.startPosition.container == rangeDetails.range.endPosition.container)
                {
                    insideRight = rangeDetails.range.endPosition.offset;
                    // also requires a break in the dom here.
                }
                var outside = Polymer.dom(rangeDetails.sContainer).node.textContent.substr(0,rangeDetails.range.startPosition.offset);
                var inside = Polymer.dom(rangeDetails.sContainer).node.textContent.substr(insideLeft,insideRight);
                Polymer.dom(rangeDetails.sContainer).node.appendChild(new  Text(inside));
                rangeDetails.range.startPosition.container.textContent = outside;
                
            }
        }
        // normalize end position container
        if(rangeDetails.eHanging)
        {
                console.log("overlapping range at end");
        }
        // normalize all nodes between the spos and epos
		if(range.startPosition.container != range.endPosition.container)
		{
            for(rn in rangeDetails.drillNodes)
            {
                wrap.removeNodeWraps(rangeDetails.drillNodes[rn],tag,attributes);
            }
            
		}	
	}	 
    wrap.overLappingItems = function(list,t,attributes){
        var isOverlap = false;
        var overlapNodes =[];
        for(i in list)
        {
            if(wrap.isOverlap(list[i], t,attributes))
            {
                overlapNodes.push(list[i])        
            }
        }
        return overlapNodes;
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
    
    wrap.rangeDetails = function(range,tag,attributes){
        // get all nodes to the right and up the left side of the trapazoid to the common parent
        // and back down to the endpos
        var nodesToDrill = function(range,sAnc,eAnc,top)
        {
            var nodeList = []
            var currentNode = range.startPosition.container;
            var dir = 1;
            var reachedTop = false;
            var ePosAnc = eAnc.indexOf(currentNode);
            var sPosAnc = sAnc.indexOf(currentNode);
            while(currentNode != range.endPosition.container)
            {
                if(Polymer.dom(currentNode).nextSibling && !(ePosAnc > -1)) dir =0;
                if(ePosAnc > -1) dir = -1;
                if(!Polymer.dom(currentNode).nextSibling && !reachedTop) dir=1;
                
                if (dir == 0)
                {
                    currentNode = Polymer.dom(currentNode).nextSibling;
                    //console.log("move right " + currentNode);
                }
                
                if(dir == -1)
                {
                    currentNode = Polymer.dom(currentNode).childNodes[0];
                    //console.log("move down " + currentNode );
                }
                if(dir == 1)
                {
                    currentNode=Polymer.dom(currentNode).parentNode;
                    //console.log("move up " + currentNode);
                }
                ePosAnc = eAnc.indexOf(currentNode);
                sPosAnc = sAnc.indexOf(currentNode);
                if(ePosAnc < 0 && sPosAnc < 0 && currentNode != range.endPosition.container)
                {
                    nodeList.push(currentNode);
                    //console.log("added " + currentNode);
                }
            }
            return nodeList;
        }
        if(range.startPosition.container != range.endPositionContainer)
        {
            var details = {"range":range};
            details["sHanging"] = 	range.endPosition.container != top && utils.isHangingPos(range.startPosition, top);
            details["eHanging"] = 	range.endPosition.container != top && utils.isHangingPos(range.endPosition, top);
            details["sMainPos"] =	utils.maybeSlidePosDown(range.startPosition);
            details["eMainPos"] =	utils.maybeSlidePosDown(range.endPosition);
            details["sContainer"] = utils.getNonCustomContainer(details["sMainPos"].container, top, true);
            details["eContainer"] = utils.getNonCustomContainer(details["eMainPos"].container, top, true);
            details["eAnc"] = utils.ancestors(details.eMainPos.container);
            details["sAnc"] = utils.ancestors(details.sMainPos.container);
            //details["commonParent"]  = utils.commonContainer(range.startPosition.container,range.endPosition.container);
            details["commonParent"] = utils.firstCommonListItem(details.sAnc,details.eAnc);
            details["drillNodes"] = nodesToDrill(range,details["sAnc"],details["eAnc"], details.commonParent);
            details["spAncOverLapping"] = wrap.overLappingItems(details.sAnc,details["commonParent"],attributes);
            details["epAncOverlapping"] = wrap.overLappingItems(details.eAnc,details["commonParent"],attributes);
        
            return details;
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
