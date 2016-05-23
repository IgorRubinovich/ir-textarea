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
		utils = ir.textarea.utils;
	
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
	
	// wrap all children of n disregarding container nodes
	wrap.wrapChildrenOfWith = function(n, wrapper, startChild, endChild) {
		var c, cn = Polymer.dom(n).childNodes, i,

		if(!startChild) startChild = Polymer.dom(n).firstChild
		if(!endChild) endChild = Polymer.dom(n).lastChild;
		
		wrapperNode = wrap.parseWrapper(wrapper);
		
		for(i = 0; i < cn.length; i++)
			wrapperNode.wrapAppend(cn[i]);

		c = 
		while(!done)
			Polymer.dom(n).appendChild(Polymer.dom(wrapperNode).firstChild);

		return wrapperNode;
	}

	// children of node considering containers where container are as in utils.isNonCustomContainer
	wrap.wrapContents = function(node, startPos, endPos, top) {
		var cn, i, len,
			extract = utils.extractContents(startPos, endPos, { delete : true }),
			nodeGroups = {}, gid = 1, cleanup;

		utils.visitNodes(node, function(n) {
			var c, i, ps;
			
			// node is in group
			if(n._group)
				return;

			if(utils.isContainer(n))
				n._group = gid++;
			
			// a previous node is in group
			while(ps = Polymer.dom(n).previousSibling)
				if(ps._group)
				{
					n._group = ps._group;
					nodeGroups[n].push(n);
					return;
				}

			if(c = utils.getNonCustomContainer(n))
			{
				nodeGroups
			}
			if(!c._group)
				
			n._group = c._group
		});
			
		cn = Polymer.dom(extract).childNodes;
		for(i = 0; i < cn.length; i++)
		{
			if(utils.isContainer(cn[i]))
				;;
		}
	}

	
	return wrap;

	//wrap.wrapRange()
})();

/*
	// wrap all children of n disregarding container nodes
	

*/
