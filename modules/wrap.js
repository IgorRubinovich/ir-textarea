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
			replaceTarget, appendTarget, lastInserted;
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
		var frag, startPath, endPath, splitRoot, 
			dummyparagraph, src, extractRes, pos, n, done,
			sAtInlineEdge, eAtInlineEdge,
			resultRange = {}, p;
			
		sAtInlineEdge = utils.atText(range.startPosition, 'start') &&
							utils.isInlineElement(utils.parentNode(range.startPosition.container));
		
		eAtInlineEdge = utils.atText(range.endPosition, 'end') &&
							utils.isInlineElement(utils.parentNode(range.endPosition.container));
		
		// save path as coordinates
		startPath = utils.posToCoordinatesPos(range.startPosition, top);
		endPath = utils.posToCoordinatesPos(range.endPosition, top);
		
		//if(utils.isHangingPos(range.startPosition, top) || utils.isHangingPos(range.endPosition, top))
		
		// find split root
		splitRoot = utils.commonContainer(range.startPosition.container, range.endPosition.container, top);
		
		// hard-extract selection up to splitRoot
		extractRes = extract.extractContents(range.startPosition, range.endPosition, { delete : true, splitRoot : splitRoot, top : top });

		// create a detached dummy paragraph
		dummyparagraph = utils.newEmptyParagraph(true);
		
		if(!extractRes)
			return range;
		
		if(splitRoot != top)
			dummyparagraph.appendChild(extractRes);
		else
			while(extractRes.firstChild)
				dummyparagraph.appendChild(extractRes.firstChild);
		
		// remember path of startPos
		wrap.wrapContents(dummyparagraph, wrapper);

		// put them all in a fragment
		frag = document.createDocumentFragment();
		
		while(dummyparagraph.firstChild)
			frag.appendChild(dummyparagraph.firstChild)

		// if wrapping bare nodes we don't want them to be merged as hanging
		pos = utils.coordinatesPosToPos(startPath, top, true, true);
		if(!utils.isNonCustomContainer(frag.firstChild) && 
			utils.isNonCustomContainer(pos.container) && 
			pos.offset == Polymer.dom(pos.container).childNodes.length &&
			utils.parentNode(pos.container) == top)
			
			pos = { container : utils.nextNodeNonDescendant(pos.container, top, true), offset : 0 };

		// inline elements require some special treatment
		// 		if pos.container is at inline element pos 0 and selection at its edge,
		//		we should paste INSIDE the inline element to avoid losing style
		if((sAtInlineEdge && utils.isInlineElement(pos.container)) || (utils.canHaveChildren(pos.container) && !pos.container.childNodes.length))
		{
			if(!Polymer.dom(pos.container).firstChild)
				Polymer.dom(pos.container).appendChild(document.createTextNode(''));
			
			pos = { container : pos.container.firstChild, offset : 0 }
		}
		else
		{
			p = utils.parentNode(pos.container);
			if(!sAtInlineEdge && !eAtInlineEdge && utils.isInlineElement(p) && Polymer.dom(p).nextSibling)
				pos = { container : Polymer.dom(p).nextSibling, offset : 0 }
		}
		
		if(frag.firstChild.is)
			utils.replaceWithOwnChildren(frag.firstChild);
		
		// and paste at startPosition
		resultRange.startPosition = range.startPosition; //{ container : frag.firstChild, offset : 0 };		
		resultRange.endPosition = ir.textarea.paste.pasteHtmlAtPosWithParagraphs(frag, pos, { top : top });;
		
		return resultRange;
	}
	
	//var criteria = function(n) { return !(n.nodeType == 3 && (utils.isLayoutElement(n) || utils.isTransitionalElement(utils.parentNode(n)))) }
	
	wrap.wrapRange = function(range, wrapper, top) {
		//wrap.getRangeContour();
		var result, criteria, operation, resultRange, sp, ep;
		
		sp = utils.posToCoordinatesPos(range.startPosition, top);
		ep = utils.posToCoordinatesPos(range.endPosition, top);
		
		result = [];
		criteria = function(n) { return !(n.nodeType == 3 && (utils.isLayoutElement(n) || utils.isTransitionalElement(utils.parentNode(n)))) }
		operation = function(n) { 
			result.push(n);
		}

		resultRange = wrap._wrapRange(range, wrapper, top, criteria, operation) || {};
	
		result.forEach(function(t) { wrap.wrapContents(t, wrapper) });
		
		return {
			startPosition : resultRange.startPosition || utils.coordinatesPosToPos(sp, top, true),  // resultRange properties will be null 
			endPosition : resultRange.endPosition || utils.coordinatesPosToPos(ep, top, true)		// if range had hanging parts 
		}
	}
	
	wrap._wrapRange = function(range, wrapper, top, criteria, operation) {
		var first, last, main, 
			sHanging, eHanging, 
			sContainer, eContainer,
			sMainPos, eMainPos, 
			sMainPath, eMainPath,
			sSub, eSub, includeLast, 
			sPath, ePath, index, max, EOD, t,
			resultRange = range;
			//criteria, operation;
			
		EOD = Polymer.dom(top).nextSibling;

		// move start and end into the prev/next container if the containers they're in are to be excluded
		while(!criteria(range.startPosition.container) || !utils.posToContainerEdgeHasContent(range.startPosition, "forward", top))
			range.startPosition = { container : utils.nextNodeNonDescendant(range.startPosition.container, top, true), offset : 0 };
		while(!criteria(range.endPosition.container) || !utils.posToContainerEdgeHasContent(range.endPosition, "backward", top))
		{
			t = utils.prevNode(range.endPosition.container, top); //{ container : utils.prevNode(range.endPosition.container, top, true), offset : 0 };
			range.endPosition = { container : t, offset : t.length };
		}

		// collect basic info
		sHanging = 	range.endPosition.container != top && utils.isHangingPos(range.startPosition, top);
		eHanging = 	range.endPosition.container != top && utils.isHangingPos(range.endPosition, top);

		sMainPos =	utils.maybeSlidePosDown(range.startPosition);
		eMainPos =	utils.maybeSlidePosDown(range.endPosition);

		sContainer = utils.getNonCustomContainer(sMainPos.container, top, true);
		eContainer = utils.getNonCustomContainer(eMainPos.container, top, true);

		 // process hanging parts
		if(sHanging)
		{
			if(sContainer == eContainer)
				sMainPos = range.startPosition;
			else
				sMainPos = utils.maybeSlidePosDown(range.startPosition); // utils.nextNodeNonDescendant(sContainer, top, true)
			
			sMainPath = utils.posToCoordinatesPos(sMainPos);
			
			t = wrap.wrapRangeSegment({ 
											startPosition : sMainPos, 
											endPosition : sContainer == eContainer ? range.endPosition : utils.getLastCaretPosition(sContainer)
										}, 	wrapper, top, true);

			sMainPos = t.endPosition;
			resultRange = t;
		}
		
		if(sContainer == eContainer && !sHanging && !eHanging)
		{
			if(criteria(sContainer))
				operation(sContainer);
		}
		
		if(eHanging && range.endPosition && (sContainer != eContainer || !sHanging))
		{
			eMainPos = utils.maybeSlidePosDown({ container : eContainer, offset : 0 });
			eMainPath = utils.posToCoordinatesPos(eMainPos);
			
			t = wrap.wrapRangeSegment({ startPosition : eMainPos, endPosition : range.endPosition }, wrapper, top, true)
			
			if(!utils.isNonCustomContainer(eContainer))
				eContainer = utils.getNonCustomContainer(eMainPos.container, top, true);

			eMainPos = utils.coordinatesPosToPos(eMainPath);
			
			resultRange.endPosition = t.endPosition;
		}

		
		if(sContainer == eContainer)
			return resultRange;
		
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

		if(sContainer == eContainer && !utils.rangeHasContent(sMainPos, eMainPos))
			return resultRange;
		
		// there's sure a main part and we are wrapping it		
		
		commonContainer = utils.commonContainer(sMainPos.container, eMainPos.container);

		utils.markBranch(range.startPosition, top, "__startBranch", true);
		utils.markBranch(range.endPosition, top, "__endBranch", true);

		sPath = utils.getElementPathFromTop(sContainer, commonContainer, true) || [];

		t = n = sContainer;

		if((!sHanging || !utils.isDescendantOf(range.startPosition.container, n, true)) && !n.__endBranch && criteria(n))
		{
			operation(n);		
			sPath = utils.getElementPathFromTop(n, commonContainer, true) || [];
			n = utils.nextNodeNonDescendant(n, top, true);
		}	
			
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
			if(t)
				n = t;
		}
		
		// the mid-nodes
		while(n && !n.__startBranch && !n.__endBranch && n != top && n != EOD)
		{
			if(criteria(n))
				operation(n);

			n = Polymer.dom(n).nextSibling;
		}

		ePath = utils.getElementPathFromTop(eContainer, n) || [];
		
		// down the tree until we meet eContainer
		while(ePath.length && n != eContainer)
		{
			t = Polymer.dom(n).firstChild;			
			n = ePath.shift();
			if(t.__startBranch)
				t = Polymer.dom(t).nextSibling;
			while(t && !t.__endBranch && t != eContainer)
			{
				if(criteria(t)) // we do want to wrap non-text transitional elements
					operation(t);

				t = Polymer.dom(t).nextSibling;
			}
		}
	
		if(!eHanging && utils.rangeHasContent({ container : eContainer, offset : 0 }, range.endPosition))
			wrap.wrapContents(eContainer, wrapper);
		
		utils.unmarkBranch(range.startPosition, top, "__startBranch");		
		utils.unmarkBranch(range.endPosition, top, "__endBranch");		
		
		return resultRange;
	}

	wrap.wrapWithAttributes = function(posr, tag, attributes, top){
		var cltag, posr, aString;
		
		cltag = tag.replace(/^\W+\w/, '')
           
			//wrap.normalizeWraps(posr,tag,attributes);
			if(! wrap.detectOverlap(posr,tag))
			{
				aString =  '';
				if(attributes && attributes['style']) astring = ' style=' + attributes['style'];
				if(attributes && attributes['class']) astring = astring + ' class=' + attributes['class'];
				
				return wrap.wrapRange(posr, "<" + tag + aString +	"><span id='insertionPoint'></span></" + cltag + ">", top);
			}
	}
    
    wrap.isOverlap = function(node,t,attributes){
        if(node != null && node.localName && t != null)
        {
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
        return false;
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
            var sFirstNonCustomPos = function(rd){
                if(rd.sAnc)
                {var x =  rd.sAnc.indexOf(rd.sContainer);
                return x;}
                else return -1;
            }   
            var anyOverlap = function(anc,start,tag,attributes)
            {
                var isAny = false
                for (var x = start; x < anc.length; x++)
                {
                    isAny  = isAny || wrap.isOverlap(anc[x],tag,attributes);
                    if(isAny) break;
                }
                return isAny;
            }
            var determineCommonWrap = function(part,container,tag,attributes)
            {
                
                for(var x= 0; x< part.anc.length;x++)
                {
                    var isOverlapThisNode = wrap.isOverlap(part.anc[x],tag,attributes);
                    var isOverlapAnyAnc = anyOverlap(part.anc[x],x+1,tag,attributes);
                    var isAtContainer = part.anc[x] ==container;
                    
                    if( !isAtContainer && !isOverlapThisNode && !isOverlapAnyAnc)
                        return part.anc[x];
                    if(isAtContainer)
                        return container;
                }
                return null;
            }
            var determineUnwrapParent = function(part, container, tag, attributes)
            {
                var isOverlap =anyOverlap(part.anc,0,tag,attributes);
                if(isOverlap)
                {
                    for(var x = 0; x< part.anc.length; x++)
                    {
                        if(wrap.isOverlap(part.anc[x],tag,attributes))
                            return part.anc[x];
                    }
                }
                else
                    return null;
                
            }
            var duplicateAncTree = function(node,top,ancList)
            {
                var stack = [];
                var current =null;
                for( x in ancList )
                {
                    current = ancList[x];
                    stack.push(Polymer.dom(current).cloneNode(false)); 
                    if(current == top)break;
                }
                //stack.push(node);
                current = stack.pop();
                var newTop = current;
                var last = newTop;
                while(current)
                {
                    current = stack.pop();
                    if(current)
                    {
                        Polymer.dom(last).appendChild(current);
                        last = current;
                    }
                }
                
                if(newTop){last.appendChild(node);return newTop;} else return node;
                
            }
            // if the firstNonCustomPos is the range's sContainer we are done with sHanging since no other wrap containers exist
            if(rangeDetails.sAnc[0] != rangeDetails.sContainer)
            { 
                var sPart0,sPart2;
                var sPart1 = {"node":window.ir.textarea.extract.extractContents(rangeDetails.sMainPos,rangeDetails.eMainPos,{"top":rangeDetails.sContainer,delete:false})};
                wrap.removeNodeWraps(sPart1.node,tag,attributes);
                sPart1['anc'] = utils.ancestors(rangeDetails.sMainPos.container);
                sPart1['common_wrap'] =determineCommonWrap(sPart1,rangeDetails.sContainer,tag,attributes);
                sPart1['unwrap_parent'] = determineUnwrapParent(sPart1,rangeDetails.sContainer,tag,attributes);
                sPart2 = {'node': window.ir.textarea.extract.extractContents({container:rangeDetails.eMainPos.container,offset:rangeDetails.eMainPos.offset }, {container:rangeDetails.eMainPos.container,offset:rangeDetails.eMainPos.offset + rangeDetails.eMainPos.container.length},{"top":rangeDetails.sAnc[sFirstNonCustomPos(rangeDetails)],'delete':false}),"anc":[]};
                // remove part2
                window.ir.textarea.extract.extractContents({container:rangeDetails.eMainPos.container,offset:rangeDetails.eMainPos.offset}, {container:rangeDetails.eMainPos.container,offset:rangeDetails.eMainPos.offset + rangeDetails.eMainPos.container.length},{"top":rangeDetails.sAnc[sFirstNonCustomPos(rangeDetails)],'delete':true})
                // remove part1
                window.ir.textarea.extract.extractContents(rangeDetails.sMainPos,rangeDetails.eMainPos,                                                                                     {"top":rangeDetails.sContainer,delete:true});
                sPart2['new_unwrap_top'] = duplicateAncTree(sPart2.node,sPart1.unwrap_parent,sPart1.anc)
                if(sPart1['unwrap_parent'] && sPart1['unwrap_parent'].nextSibling != null)
                {
                    
                    Polymer.dom(sPart1['unwrap_parent'].parentNode).insertBefore(sPart2.new_unwrap_top,sPart1['unwrap_parent'].nextSibling);
                    Polymer.dom(sPart1['unwrap_parent'].parentNode).insertBefore(sPart1.node,sPart1['unwrap_parent'].nextSibling);
                }
                else
                {
                    Polymer.dom(sPart1['common_wrap']).appendChild(sPart2.node);
                    Polymer.dom(sPart1['common_wrap']).appendChild(sPart1.node);
                }
            }
            
        }
        // normalize all nodes between the spos hanging  and epos hanging parts
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
            if(range.startPosition.container == range.endPosition.container)
                details["sPosRight"] = range.endPosition;
            else
                details["sPosRight"] = { container : range.startPosition.container, offset : range.startPosition.container.textContent.length}
        
            return details;
        }
        
    }

	// internal method, will replace/wrap the node and return the node from which wrapRangeBlockLevel will look for nextSibling
	// if wrapper is null, will create a paragraph to wrap bare nodes but make no change to others
	wrap.wrapOrReplaceNode = function(node, wrapper, top, stopCondition) { 
		var newNode, orig, subtrans, cea, t, topBoundaryCondition, bottomBoundaryCondition, nextStop;
		
		topBoundaryCondition = function(m, noTrans) { 
			return 	m && (
					utils.isNonCustomContainer(m) && 
						(noTrans || (!utils.isTransitionalElement(m) &&
							!utils.isSubTransitionalElement(m))) &&
								!(utils.getTopCustomElementAncestor(m, top, true) && m.getAttribute('contenteditable')))
		},
		bottomBoundaryCondition = function(n) {
			if(n.__endBranch && n.nodeType == 3 && !nextStop)
				nextStop = 1
			else
			if(nextStop)
				nextStop = 2;
			
			return	n && (!n.__endBranch || (nextStop == 1)) && (nextStop != 2) && (n.nodeType == 3 || utils.isInlineElement(n) || !utils.canHaveChildren(n)); 
		}
	
		if(topBoundaryCondition(node))
		{
			if(wrapper)
				return utils.replaceTag(node, wrapper);
			
			return node;
		}
		newNode = wrapper ? utils.createTag(wrapper) : utils.newEmptyParagraph(true);
		
		subtrans = utils.isSubTransitionalElement(node);
		cea = utils.getTopCustomElementAncestor(node, top, true) && node.getAttribute('contenteditable');
		
		// starting with subtransitional / custom element - start looking at its first child
		if(subtrans || cea)
		{
			node = Polymer.dom(node).firstChild;
			// empty subtrans - simply create the wrapper element
			if(!node)
			{
				Polymer.dom(node).appendChild(newNode);
				return node;
			}
		}
		// else start with the given node and go up while there are inline/text/atomic nodes
		else
		{
			t = node;
			while(t && !topBoundaryCondition(t, true))
			{
				t = Polymer.dom(t).previousSibling;
				node = !topBoundaryCondition(t, true) && t || node;
			}
		}

		Polymer.dom(utils.parentNode(node)).insertBefore(newNode, node);

		do {
			Polymer.dom(newNode).appendChild(node);
			node = Polymer.dom(newNode).nextSibling;
		} while(node && bottomBoundaryCondition(node))		
		
		Polymer.dom.flush();
	
		return newNode;
	}
	
	// where can take two values: "before" or "after"
	wrap.unwrapListItem = function(item, refNode, after, noParagraph) {
		var t = item, nt, 
			action = "insertBefore",
			//refNode = list, par,
			lp = Polymer.dom(utils.parentNode(refNode)),
			par;

		if(after && !Polymer.dom(refNode).nextSibling)
			action = "appendChild";
		
		// block level, custom and transitional elements (standalone containers) are moved as is
		if(noParagraph || utils.isNonCustomContainer(t) || t.is || utils.isTransitionalElement(t))
			lp.insertBefore(t, refNode);
		// others are wrapped in a new paragraph until end/standalone container
		else
		if(t)
		{
			par = utils.newEmptyParagraph(true);
			lp[action](par, refNode);
			par = Polymer.dom(par);
			do
			{
				nt = Polymer.dom(t).nextSibling;
				par.appendChild(t);
				t = nt;
			} while(t); // && !(utils.isNonCustomContainer(t) || t.is || utils.isTransitionalElement(t)))
		}
	
		return par || t;
	}
	
	wrap.wrapRangeList = function(range, listTag, top, forceWrap) {
		var r, sc, ec, listCont, list, last, pl, stripArr, t, done, lis, noParagraph, after, where, newList, refNode,
			isWantedTag = function(n) { return utils.isTag(n, listTag); }, 
			isListItem = function(n) { return utils.isTag(n, 'LI') };

		listTag = listTag && listTag.toUpperCase();
		
		refNode = list = utils.queryAncestor(range.startPosition.container, isWantedTag, top, true);
		
		// unwrap
		if(list && !forceWrap) 
		{
			// 		start\end		before			start			middle			end/after
			//		before			-				-				-				-			-
			//		start			-				before			before			before,del
			//		middle			-				-				before,split	after
			//		end				-				-				-				after
			//		after			-				-				-				-

			// set up stuff
			listCont = Polymer.dom(utils.parentNode(list));
			
			isListItem = function(n) { return utils.isTag(n, 'LI') && utils.parentNode(n) == list };
			
			sc = utils.queryAncestor(range.startPosition.container, isListItem, top, true);
			ec = utils.queryAncestor(range.endPosition.container, isListItem, top, true);
			
			lis = Polymer.dom(list).childNodes;
			while(lis.length > 0 && lis[0] != sc && list[0] != ec) 
				after = lis.shift(); // skip until sc

			lis = lis.filter(function(n) { var t; if(!(t = utils.isTag(sc, 'LI'))) utils.removeFromParent(n); return t} );
			noParagraph = lis.length == 1 && (listCont.node == top || utils.singleChildNode(listCont.node));

			if(after)
			{
				refNode = newList = Polymer.dom(list).cloneNode();
				listCont[list == listCont.lastChild == list  ? 'appendChild' : 'insertBefore'](newList, Polymer.dom(list).nextSibling);
			}

			while(lis.length && !done) {
				sc = lis.shift();
				while(t = Polymer.dom(sc).firstChild)
					last = wrap.unwrapListItem(t, refNode, after, noParagraph);
				
				utils.removeFromParent(sc);
				
				done = sc == ec;
			} 
			
			if(!utils.nodeHasContent(list))
				utils.removeFromParent(list);
			if(newList)
			{
				while(lis.length)
					Polymer.dom(newList).appendChild(lis.pop());
			}
				
			return range;
		}

		// wrap
		
		r = wrap.wrapRangeBlockLevel(range, 'li', null, top);
		
		sc = utils.queryAncestor(range.startPosition.container, isListItem, top, true);
		ec = utils.queryAncestor(range.endPosition.container, isListItem, top, true);
		
		list = Polymer.dom(Polymer.dom(sc).parentNode).insertBefore(utils.createTag(listTag), sc);
		
		pl = Polymer.dom(list)
		
		pl.appendChild(last = sc);
	
		while(last != ec)
			pl.appendChild(last = pl.nextSibling);
		
		Polymer.dom.flush();

		return r;
	}
	
	// default indent step = arbitrary 20px
	// also is not strictly correct if text is rtl
	var wrapStep = 20;
	
	wrap.wrapIndent = function(range, decrease, top) {
		var indentWrapProcessor = function(n) {
			var padding = Number(n.style.paddingLeft.replace(/px/,'') || 0);
			n.style.paddingLeft = !decrease ? 
				(padding + wrapStep) + "px" : 
					(padding <= wrapStep ? 
					0 : 
					(padding - wrapStep) + "px");
		}
		
		return wrap.wrapRangeBlockLevel(range, null, null, top, { processWrappedNode : indentWrapProcessor });
	}
		
	wrap.wrapRangeBlockLevel = function(range, wrapper, attributes, top, opts) {
		var sContainer, eContainer, t, tag,
			process = function(n) {
				var m, p = utils.parentNode(n);
				
				m = wrap.wrapOrReplaceNode(n, wrapper, top);
				if(opts.processWrappedNode)
					opts.processWrappedNode(n);
				if(attributes)
					utils.setAttributes(sContainer, attributes)
				
				return m;
			};
			
		if(!opts)
			opts = {};

		sContainer = utils.getNonCustomContainer(range.startPosition.container, top, true);
		eContainer = utils.getNonCustomContainer(range.endPosition.container, top, true);
		
		utils.markBranch(range.endPosition.container, top, "__endBranch");

		// first and only
		if(sContainer == eContainer)
		{
			process(sContainer);
			return range;
		}
		
		// or first to end excluding last
		n = sContainer;
		while(n && !n.__endBranch) // && !utils.isNonCustomContainer(n))
		{
			n = process(n);
			n = Polymer.dom(n).nextSibling;
		}
		
		// and last if in same container
		t = utils.getNonCustomContainer(n, top, true);
		if(n && t && (t == eContainer || utils.parentNode(n) != top))
			process(t);

		utils.unmarkBranch(range.endPosition.container, top, "__endBranch");

		return range;
	}

	return wrap;

	//wrap.wrapRange()
})();

/*
	// wrap all children of n disregarding container nodes
	

*/
