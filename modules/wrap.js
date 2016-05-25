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
	wrap.splitNodeIntoWrapGroups = function(node, top, criteria) {
		var cn, 
			childGroups,
			groups = [[]], 
			gid = 0, 
			n, i;
		
		criteria = criteria || Symbols.WRAPCONTAINER;
		
		cn = Polymer.dom(node).childNodes;
		
		for(i = 0; i < cn.length; i++)
		{
			n = cn[i];
			if(Symbols.TEXT(n) || Symbols.NCBLOCK(n))
				groups[gid].push(n);
			else
			if(!Symbols.NCBLOCK(n) && utils.isInLightDom(n, top))
			{
				childGroups = wrap.splitNodeIntoWrapGroups(n, top);
				if(childGroups.length == 1 && !criteria(n))
					groups[gid].push(n);
				else
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
		var extract = utils.extractContents(range.startPosition, range.endPosition, { delete : true });
		
		if(Symbol.WRAPCONTAINER(extract))
			extract.splitIntoWrapGroups(node).forEach(function(g) { wrap.wrapNodes(g, wrapper); });
		
	
	}
	
	wrap.wrapRange = function(range, wrapper) {
		var frag, startPath, endPath, splitRoot, extract, dummyparagraph;
		
		// save path as coordinates
		startPath = utils.posToCoorinatesPos(range.startPosition);
		endPath = utils.posToCoorinatesPos(range.startPosition);
		
		// find split root
		splitRoot = utils.commonContainer(range.startPosition.container, range.endPosition.container);
		
		// hard-extract selection up to splitRoot
		extract = utils.extractContents(range.startPosition, range.endPosition, { delete : true, splitRoot : splitRoot });
		
		// create a detached dummy paragraph
		dummyparagraph = utils.newEmptyParagraph(true);
		
		// remember path of startPos
		dummyparagraph.appendChild(extract);
		wrap.wrapContents(dummyparagraph, wrapper);

		// put them all in a fragment
		frag = document.createDocumentFragment();
		while(dummyparagraph.firstChild)
			frag.appendChild(dummyparagraph.firstChild)
		
		// and paste at startPosition
		ir.textarea.paste.pasteHtmlAtPos(frag, utils.coordinatesPosToPos(startPath));
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
