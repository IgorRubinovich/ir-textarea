// dom/range utility functions

if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.utils = (function() {
	var utils = {};
	
	var INLINE_ELEMENTS = {};
	
	"font,b,big,i,u,small,tt,abbr,acronym,cite,code,dfn,em,kbd,strong,samp,time,var,a,bdo,br,img,map,object,q,script,span,sub,sup".split(/,/)
		.forEach(function(tag) { INLINE_ELEMENTS[tag.toUpperCase()] = true });
		
	var TRANSITIONAL_ELEMENTS = ['OL', 'UL', 'TABLE', 'TBODY', 'THEAD', 'TH', 'TR'],
		LAYOUT_ELEMENTS = ['TBODY', 'THEAD', 'TH', 'TR'],
		SUBTRANSITIONAL_ELEMENTS = ['LI', 'TD'];

	utils.recursiveInnerHTML = function(el, skipNodes) {
		skipNodes = skipNodes || [];

		if(el.originalInnerHTML)
			return el.originalInnerHTML;
		
		if(!((el.is ? Polymer.dom(el) : el).childNodes.length))
			return "";

		return Array.prototype.map.call((el.is ? Polymer.dom(el) : el).childNodes, function(node) {
				if(skipNodes && skipNodes.indexOf(node) > -1)
					return "";

				if((node.is ? Polymer.dom(node) : node).childNodes.length)
					return utils.recursiveOuterHTML(node, skipNodes);
				else
					return utils.tagOutline(node);
			}).join('');
	}

	// by Nathan P. Cole from http://stackoverflow.com/questions/3158274/what-would-be-a-regex-for-valid-xml-names
	utils.isXMLTagName = function(tag) // returns true if meets cond. 1-5 above
	{
		var t = !/^[xX][mM][lL].*/.test(tag); // condition 3
		t = t && /^[a-zA-Z_].*/.test(tag);  // condition 2
		t = t && /^[a-zA-Z0-9_\-\.]+$/.test(tag); // condition 4
		return t;
	}
	
	utils.isCustomElementName = (function(n) {
		var cache = {};
		return function(tagName) {
			var c = cache[tagName];
			if(c)
				return c;
			else
				return cache[tagName] = utils.isXMLTagName(tagName) && !!document.createElement(tagName).is;
		}
	})();

	utils.cloneCustomElement = function(el) {
		var n = document.createElement(el.tagName), a;
		for(i = 0; i < el.attributes.length; i++)
		{
			a = el.attributes[i];
			n.setAttribute(a.name, a.value);
		}
		n.innerHTML = recursiveInnerHTML(el);
		return n;
	}
	
	utils.reattachCustomElements = function(root) {
		utils.visitNodes(root, function(el) {  // hard-reattach custom elements lest they lose their powers
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
	}
	
	// effectively outerHTML - innerHTML
	utils.tagOutline = function(el) {
		var d = document.createElement('div'),
			classList, props, cn, divclone, i, tn, canHaveChildren, res;

		if(!el) return '';
		if(el.isCaret) return '';

		if(el.nodeType == 3) return el.textContent;
		
		if(canHaveChildren = utils.canHaveChildren(el))
			nn = document.createElement('div');
		else
			nn = el.cloneNode();

		
		if(el.attributes)
			Array.prototype.forEach.call(el.attributes, function(a) { if(a.value != '') nn.setAttribute(a.name, a.value) });

		nn.removeAttribute('contenteditable');

		if(nn.classList)
		{
			// remove Polymer style scopers
			Array.prototype.forEach.call(nn.classList, function(cl) { if(utils.isCustomElementName(cl)) nn.classList.remove(cl); });
			nn.classList.remove('style-scope');
		}		
		
		if(!nn.classList.length) nn.removeAttribute("class");
		
		d.appendChild(nn);

		tn = el.tagName ? el.tagName.toLowerCase() : "";

		if(canHaveChildren)
			res = d.innerHTML.replace(/div/i, tn).replace(/div>$/, tn + ">");
		else
			res = d.innerHTML;
		
		return res;
	}

	// outerHTML that works with any nodes including DocumentFragment
	utils.outerHTML = function(el, escape) {
		var r = "";
		if(el instanceof DocumentFragment)
			for(var i = 0; i < el.childNodes.length; i++)
				r += el.childNodes[i].nodeType == 3 ? el.childNodes[i].textContent : utils.recursiveOuterHTML(el.childNodes[i]);
		else
			r =  utils.recursiveOuterHTML(el);
		
		if(escape)
			r = r.replace(/\</g, '&lt;').replace(/\>/g, '&gt;')
		
		return r;
		
	}

	
	utils.recursiveOuterHTML = function(node, skipNodes){
		var outerHTML, innerHTML, childNodes, res;

		if(skipNodes && skipNodes.indexOf(node) > -1)
			return "";

		if(node.nodeType == 3)
			return node.textContent;
		
		if(node.is && node.originalInnerHTML)
			innerHTML = node.originalInnerHTML;
		else
		{
			childNodes = node.is ? Polymer.dom(node).childNodes : node.childNodes;
			if(!childNodes.length)
				return utils.tagOutline(node);

			innerHTML = (node.is && node.originalInnerHTML) ? node.originalInnerHTML : Array.prototype.map.call(childNodes, function(n) { 
				return utils.recursiveOuterHTML(n, skipNodes) 
			}).join('');
		}

		res = utils.tagOutline(node)
		if(innerHTML)
			res = res.replace(/(\<[^\>]+\>)/, function(m) { return m + innerHTML })

		return res;
	}

	// if node is in light dom tree will return the node,
	// otherwise will return the closest parent custom element that is in light dom
	utils.getClosestLightDomTarget = function(node, top) {
		var customParents = [], cn, n = node, i, goDeeper;

		while(n && n != top && n != document)
		{
			if(utils.isInLightDom(n, top))
				return n;

			n = n.parentNode;
		}

		return n;
	}

	utils.isInLightDom = function(node, top, includeTop) { // is in light dom relative to top, i.e. top is considered the light dom root like a scoped document.body
		var p = node;

		if(!node)
			return false;
		
		while(p = Polymer.dom(p).parentNode)
			if(p == document.body || p == top)
				return true;

		return false;
	}

	// returns topmost custom element or null below or equal to `top`
	utils.getTopCustomElementAncestor = function(node, top) {
		var res, n = node;
		
		if(!top) top = document.body;

		while(n && n != top)
		{
			if(n.is && n != node)
				res = n;

			n = utils.parentNode(n, top);
		}

		return (n == top) ? res : null;
	}

	utils.getChildPositionInParent = function(child, skipCaret) {
		var i, cn, p, l, c = 0, res;
		if(!child || child == document.body)
			return null;

		p = utils.parentNode(child)
		
		cn = Polymer.dom(p).childNodes; // p.is ? Polymer.dom(p).childNodes : p.childNodes;
		i = -1;
		l = cn.length;
		while(i < l && !res)
		{
			i++;
			if(cn[i] && cn[i].isCaret)
				c++;
			if(cn[i] == child)
				res = i;
		}
		
		if(i >= 0)
			return res - (skipCaret ? c : 0);
		
		throw new Error("couldn't find " + child + " in " + utils.parentNode(child));
	}
	
	utils.isNonCustomContainer = function(el) {
		return el && !el.is && 
				utils.canHaveChildren(el) && 
				(!utils.isInlineElement(el) || utils.isParagraph(el)) && !utils.isTransitionalElement(el);
	}
	
	utils.getLastAncestorBeforeTop = function(el, top) {
		if(el == top)
			return el;
		
		while(el && (n = utils.parentNode(el)) != top)
			el = n;
		
		return el;
	}
	
	utils.getNonInlineContainer = function(child, top, excludeTop) {
		while(child && child != top && child.nodeType == 3 || utils.isInlineElement(child) || !utils.canHaveChildren(child))
			child = utils.parentNode(child);
		
		return child;
	}
	
	utils.getNonCustomContainer = function(child, top, excludeTop) {
		var c = child, ncc;

		// removed experimentally
		// ncc = utils.getTopCustomElementAncestor(child, top);
		if(ncc)
			child = ncc;
		
		while(child && child != top && !utils.isNonCustomContainer(child) && (!excludeTop || Polymer.dom(child).parentNode != top))
			child = utils.parentNode(child);
		
		return child;
	}

	utils.getOnlyNonCustomContainer = function(child, top, excludeTop) {
		var ncc = utils.getNonCustomContainer(child, top, excludeTop);
		
		return ncc && utils.isNonCustomContainer(ncc) && ncc;
	}
	
	utils.replaceNodeWith = function(node, newnode) {
		var pn = utils.parentNode(node);
		
		pn.insertBefore(newnode, node);
		pn.removeChild(node);
	
		return newnode;
	}
		
	utils.nodesInSameNonCustomContainer = function(c1, c2) {
		return getNonCustomContainer(c1) == getNonCustomContainer(c2)
	}
	
	utils.posInSameContainer = function(p1, p2) {
		var pd1, pd2;
		
		if(p1.container == p2.container)
			return true;
		
		pd1 = Polymer.dom(p1.container);
		pd2 = Polymer.dom(p2.container);
		
		if(pd1.parentNode == pd2.parentNode)
			return true;
	
		// last position
		if(!pd2.childNodes[p2.offset] && pd1.parentNode == p2.container)
			return true;

		if(!pd1.childNodes[p1.offset] && pd2.parentNode == p2.container)
			return true;
		
		return;
	}
	
	utils.posToCoorinatesPos = function(pos, top, skipCaret) {
		if(!pos)
			return null;

		return { container : utils.getChildPathFromTop(pos.container, top, skipCaret), offset : pos.offset };
	}

	utils.coordinatesPosToPos = function(coordinatePos, top, skipCaret, approximate) {
		if(!coordinatePos)
			return null;
		
		return { container : utils.getChildFromPath(coordinatePos.container, top, skipCaret, approximate), offset : coordinatePos.offset };
	}

	// return an array of elements from child to top, includes top by default
	utils.getElementPathFromTop = function(child, top, excludeTop) {
		var path = [];
		while(child && child != top)
		{
			path.unshift(child)
			child = utils.parentNode(child);
		}
		if(child == top && !excludeTop)
			path.unshift(child);
		
		if(child == top)
			return path;
		
		return null;		
	}
	
	// misnamed. returns element's numeric path from top
	utils.getChildPathFromTop = function(child, top, skipCaret) {
		var t = [], p = child;

		top = top || document.body;
		
		while(p && p != top)
		{
			t.unshift(utils.getChildPositionInParent(p, skipCaret));
			p = Polymer.dom(p).parentNode
		}
		if(p != top)
			return null;

		return t;
	}

	utils.getChildFromPath = function(pathArr, top, skipCaret, approximate)
	{
		var res, i = 0, k, next, cn, coord, c = 0;
	
		top = top || document.body;
	
		res = top;
	
		if(!pathArr || !pathArr.length)
			return null;

		while(i < pathArr.length)
		{
			cn = Polymer.dom(res).childNodes;
			coord = pathArr[i];
			if(skipCaret)
				for(k = 0; k <= coord; k++)
					if(cn[k] && cn[k].isCaret)
						c++, coord++;
			
			if(coord >= 0)
				next = cn[coord];

			if(!next)
				if(approximate)
				{
					pathArr.pop();
					return utils.getChildFromPath(pathArr, top, skipCaret, true);
				}
				else
					return null;

			res = next;
			
			i++;
		};
		
		// if there's no element at path approximate to closest meaningful result
		
		return res;
	}

	utils.caretPositionFromPoint = function(x, y)
	{
		var res = {};
		if (document.caretPositionFromPoint) {
			res.range = document.caretPositionFromPoint(x, y);
			if(res.range)
			{
				res.node = res.range.offsetNode;
				res.offset = res.range.offset;
			}
		} else if (document.caretRangeFromPoint) {
			res.range = document.caretRangeFromPoint(x, y);
			if(res.range)
			{
				res.node = res.range.startContainer;
				res.offset = res.range.startOffset;
			}
		}
		
		res.container = res.node; // .node is deprecated

		return res.range ? res : null;
	}

	utils.setCaretAt = function(startTarget, startOffset, endTarget, endOffset) {
		var sel = window.getSelection(),
			range = document.createRange(),
			currentrange = utils.getSelectionRange();

		if(!endTarget)
		{
			endTarget = startTarget;
			endOffset = startOffset;
		}

		if(currentrange &&
			(currentrange.startContainer == range.startContainer && 
			currentrange.startOffset == range.startOffset) && 
			( currentrange.collapsed || (
				currentrange.endContainer == range.endContainer && 
				currentrange.endOffet == range.endOffet
				)
			)
		)
			return
		
		range.setStart(startTarget, startOffset);
		range.setEnd(endTarget, endOffset);

		if(startTarget == endTarget && startOffset == endOffset)
			range.collapse(true); // false means collapse to end point

		sel.removeAllRanges();
		sel.addRange(range);
		
		if(this.isCaret)
			this.update();

		return range;
	};
	
	utils.prevPos = function(pos, top) {
		var n, p, ncc;
		
		if(!pos)
			return;

		if(pos.container.nodeType == 3 && utils.atText(pos) != 'start')
			return { container : pos.container, offset : pos.offset - 1 }
		
		if(utils.posToContainerEdgeHasContent(pos, "backward"))
		{
			p = utils.prevNode(pos.container, top);
			return { container : p, offset : p.nodeType == 3 ? p.textContent.length : 0 };
		}

		// no more content in container
		ncc = utils.getNonCustomContainer(pos.container, top);
		
		// was at first pos in container
		if(pos.container == Polymer.dom(ncc).firstChild && pos.offset == 0)
			return { container : utils.prevNode(pos.container, top), offset : p.nodeType == 3 ? p.textContent.length : 0 }
		
		// return first pos in container
		return { container : Polymer.dom(ncc).firstChild, offset : 0 }
	}
	
	utils.nextPos = function(pos, top, skipText) {
		var n, ncc;
		
		if(!pos)
			return;

		if(!skipText && utils.atText(pos) != 'end')
			return { container : pos.container, offset : offset + 1 }
		
		if(utils.posToContainerEdgeHasContent(pos, "forward"))
			return { container : utils.nextNode(pos.container, top), offset : 0 };
		
		// no more content in container
		ncc = utils.getNonCustomContainer(pos.container, top);
		
		// was at last pos in container
		if(pos.container == ncc && pos.offset == Polymer.dom(ncc).childNodes.length)
			return { container : utils.nextNode(pos.container, top), offset : 0 }
		
		// return last pos in container
		return { container : ncc, offset : Polymer.dom(ncc).childNodes.length }
	}
	
	utils.nextNode = function(node, top, skipAncestors) {
		var next, done;
		
		if(!node)
			return;
		
		if(node.is)
			node = Polymer.dom(node);

		if(Polymer.dom(node).childNodes && Polymer.dom(node).childNodes.length)
			return Polymer.dom(node).firstChild;

		while(node && node != top && !next) // !Polymer.dom(node).nextSibling) {
		{
			next = Polymer.dom(node).nextSibling;
			if(!next || !utils.isInLightDom(next, top))
				next = Polymer.dom(node).nextSibling;
			
			next = utils.isInLightDom(next, top) && next;
			
			node = utils.parentNode(node, top);
		}
		
		if (!next)
			return null;
		
		return next;
	}

	utils.prevNode = function(node, top) {
		var pn, done, ild;
		
		if(node == top)
			return top;

		if(!Polymer.dom(node).previousSibling && Polymer.dom(node).parentNode == top)
			return top;
		
		pn = node;
		while(!done)
		{
			if(Polymer.dom(pn).previousSibling && (ild = utils.isInLightDom(Polymer.dom(pn).previousSibling, top)))
				done = pn;
			else
				done = pn = utils.parentNode(pn, top);
				
			if(!pn || pn == top)
				return pn;			
		}

		if(pn == node)
		{
			pn = Polymer.dom(pn).previousSibling;
			while(Polymer.dom(pn).lastChild)
				pn = Polymer.dom(pn).lastChild
		}
		return pn;
	}
	
	// where: start, end, middle. note that sometimes start == end
	// if no `where` argument is given will return false or the position.
	
	// Example 1: utils.atText({ container : node, offset : 1 }),  "middle")
	// Example 2: utils.atText({ container : node, offset : 1 })) -(return)-> "middle"
	utils.atText = function(pos, where){
		var r;
		
		if(!pos || !pos.container)
			return false;
		
		if(pos.container.nodeType != 3)
			return false;
		
		l = pos.container.textContent.length;
		
		if(pos.offset == 0)
			r = 'start';
		else
		if(pos.offset > 0 && pos.offset < l)
			r = 'middle';
		else
		if(pos.offset == l)
			r = 'end';
		
		if(where)
			return where == r;
		
		return r;
	}
	
	utils.parentNode = function(node, top) {
		if(node == top) // || node.parentNode == top)
			return top;
		
		//if(!utils.getTopCustomElementAncestor(node.parentNode, top))
		//	return node.parentNode;
		
		if(node instanceof DocumentFragment)
			return node.host;
		
		return Polymer.dom(node).parentNode;

		/*if(Polymer.dom(node).parentNode != node.parentNode && utils.isInLightDom(node, top)) // && !utils.isInLightDom(node.parentNode, top))
			return Polymer.dom(node).parentNode;
		else
			return node.parentNode;*/
	}

	// similar to strcmp, compares two nodes in terms of document flow order
	// <0	n1 is before n2 in flow
	// 0	n1 == n2
	// >0	n1 is after n2 in flow
	utils.nodecmp = function(n1, n2, top) {
		var t = n1, painted = [], res, i, cn, pn;
		
		if(n1 == n2)
			return 0;

		// paint up from n1
		while(t && !res && t != top)
		{
			pn = utils.parentNode(t, top);
			
			if(t.nextSibling == n2 || pn == n2)
				res = -1;

			t.__painted__ = "n1";

			painted.push(t);

			t = pn;
		}
		
		// look for painted node from n2 up
		if(!res) {
			t = n2;
			while(t && t != top && !res && (pn = utils.parentNode(t, top)) && !pn.__painted__)
			{
				painted.push(t);
				t.__painted__ = "n2";
				t = pn;
			}
			
			if(pn)
				t = pn;
			
			if(t == n1)
				res = -1;
			else
			{
				cn = (t.is ? Polymer.dom(t).childNodes : t.childNodes);
				for(i = 0; !res && i < cn.length; i++)
					if(cn[i].__painted__)
						res = cn[i].__painted__ == 'n1' ? -1 : 1;
			}
		}

		// clean up the paint
		while(painted.length)
			painted.pop().__painted__ = null;

		return res;
	}

	// similar to strcmp, compares two caret positions in terms of document flow order
	// n1 and n2 are range-like objects with .container and .offset properties
	// <0	n1 is before n2 in flow
	// 0	n1 == n2
	// >0	n1 is after n2 in flow
	utils.caretposcmp = function(n1, n2, top) {
		if(n1.container == n2.container)
			return n1.offset - n2.offset

		if(utils.isContainer(n1.container))
		{
			n1.container = n1.container.childNodes[n1.offset];
			n1.offset = 0;
		}

		if(utils.isContainer(n2.container))
		{
			n2.container = n2.container.childNodes[n2.offset];
			n2.offset = 0;
		}
		
		return utils.nodecmp(n1.container, n2.container, top)
	}
	
	utils.prevNodeDeep = function(node, top, opts) {
		var pn;

		if(!opts) opts = {};
		//node = node.is ? node : Polymer.dom(node);
		if(!Polymer.dom(node).previousSibling)
		{
			pn = Polymer.dom(node).parentNode;
			if(!opts.skipAncestors)
				return pn;
			else
			{
				while(pn && pn != top && !Polymer.dom(pn).previousSibling)
					pn = Polymer.dom(pn).parentNode;

				if(!pn || pn == top)
					return pn;

				pn = Polymer.dom(pn).previousSibling;
			}
		}
		else
			pn = Polymer.dom(node).previousSibling

		if(pn.nodeType == 3)
			return pn;

		while(Polymer.dom(pn).lastChild && (!opts.atomicCustomElements || !pn.is))
			pn = Polymer.dom(pn).lastChild;

		return pn;
	}

	utils.canHaveChildren = (function() {
		var cache = {};
		return function(node) {
			if(!node || node.nodeType != 1 || !node.tagName)
				return false;

			if(node.is)
				return true;

			if(node && typeof node.canHaveChildren == 'boolean')
				return cache[node.tagName] = node.canHaveChildren
			if(node && typeof node.canHaveChildren == 'function')
				return cache[node.tagName] = node.canHaveChildren();

			return cache[node.tagName] = node.nodeType === 1 && node.ownerDocument.createElement(node.tagName).outerHTML.indexOf("></") > 0;
		}
	})();
	
	utils.setAtFirstCaret = function(node) {
		var p = utils.getFirstCaretPosition();
		utils.setCaret(p.containt, p.offset)
	},

	utils.getFirstCaretPosition = function(node) {
		var n, res, cn;

		if(node.nodeType == 3)
			return { container : node, offset : 0 };

		cn = node.is ? node.childNodes : Polymer.dom(childNodes);
		
		if(cn.length)
			while(!res && n < node.childNodes.length)
				res = getFirstCaretPosition(cn[n]);

		return res;
	};


	utils.getLastCaretPosition = function(node, offset) {
		var lastContainer, pos;

		if(!node)
			return ni

		if(node.nodeType == 1 && (offset || offset == 0))
			node = Polymer.dom(node).childNodes[offset];

		if(!node || (node.nodeType == 1 && !utils.canHaveChildren(node)))
			if(offset)
				return { container : node, offset : offset }
			else
				return null;

		if(node.nodeType == 1)
		{
			if(Polymer.dom(node).childNodes.length)
			{
				lastContainer = node.childNodes[node.childNodes.length-1];
				while(!(pos = utils.getLastCaretPosition(lastContainer)) && lastContainer.previousSibling)
					lastContainer = lastContainer.previousSibling;
			
				while(lastContainer == utils.isLayoutElement(lastContainer))
					lastContainer = utils.prevNode(lastContainer, top)
			}

			return pos || { container : node, offset : node.nodeType == 3 ? node.textContent.length : 0 };
		}
		else
			return { container : node, offset : node.textContent.length }
	};
	
	utils.samePos = function(p1, p2) {
		return p1.container == p2.container && p1.offset == p2.offset;
	}
	utils.clonePos = function(pos) {
		return { container : pos.container, offset : pos.offset };
	}
	
	utils.maybeSlidePosDown = function(pos) {
		if(utils.isNonCustomContainer(pos.container) && Polymer.dom(pos.container).childNodes[pos.offset])
			return { container : Polymer.dom(pos.container).childNodes[pos.offset], offset : 0 }
	
		else 
			return pos;
	}
	
	// a node has content if it is or contains a text node / a non-container block / a custom element
	utils.nodeHasContent = function(node) {
		return utils.visitNodes(node, function(n, meta, prevRes) {
			return prevRes || n.nodeType == 3 || !utils.canHaveChildren(n) || n.is;
		});
	}
	
	utils.rangeHasContent = function(startPos, endPos, top) { 
		var n, m;
		
		startPos = utils.maybeSlidePosDown(startPos);
		endPos = utils.maybeSlidePosDown(endPos);

		n = startPos.container;
		m = endPos.container;

		if(utils.canHaveChildren(m) && Polymer.dom(m).childNodes.length == endPos.offset)
			m = utils.nextNodeNonDescendant(m);
		
		if(n.nodeType == 3 && !utils.isLayoutElement(n))
			// same text container check
			if(n == m)
				return startPos.offset - endPos.offset
			else
			// start is not at end of text
			if(!utils.atText(startPos, 'end'))
				return true;
			else
			{
				n = utils.nextNode(n);
				if(utils.isTag(n, 'br'))
					n = utils.nextNode(n);
			}
		
		// end is not at start of text
		
		//if(!utils.posInSameContainer(startPos, { container : m, offset : 0 }))
		//	return false;
		
		if(n == m)
			return false;
		
		while(n && n != m)
			if(!utils.isTransitionalElement(n) &&
				(!utils.getTopCustomElementAncestor(n, top) || utils.parentNode(n).hasAttribute("contenteditable"))
				&& (n.nodeType == 3 || !utils.canHaveChildren(n) || n.is))
				return true;
			else
			if(utils.isNonCustomContainer(n) && n.childNodes.length == startPos.offset)
				n = utils.nextNodeNonDescendant(n, top);
			else
				n = utils.nextNode(n, top);
			
		return false;
	}
	
	utils.nextNodeNonDescendant = function(n, top, skipAncestors) {
		var r;
		top = top || document.body;
		if(r = Polymer.dom(n).nextSibling)
			return r;
		
		r = utils.parentNode(n);
		while(r && !Polymer.dom(r).nextSibling && r != top)
			r = utils.parentNode(r);
		
		if(skipAncestors)
			r = Polymer.dom(r).nextSibling
	
		return !r || r == top ? top.nextSibling : r;
	}
	
	utils.isHangingPos = function(pos, top) {
		if(utils.isLayoutElement(pos.container))
			return false;

		return utils.posToContainerEdgeHasContent(pos, "forward", top) && 
					utils.posToContainerEdgeHasContent(pos, "backward", top);
	
	}
	
	utils.posToContainerEdgeHasContent = function(pos, dir, top) {
		var atText, cont = utils.getNonCustomContainer(pos.container, top), n, pos, otherpos, t;
		
		atText = utils.atText(pos);
		
		if(dir == "backward" && atText && atText != 'start')
			return true
		else
		if(dir == "forward" && atText && atText != 'end')
			return true;
		
		// when cont is top, walk in dir until we meet a container
		if(cont == top)
		{
			n = utils.getLastAncestorBeforeTop(pos.container, top) || pos.container;
			while(n && !utils.isNonCustomContainer(n))
			{
				cont = n;
				n = Polymer.dom(n)[dir == "backward"  ? "previousSibling" : "nextSibling"];
			}
			
			if(!n)
				n = cont;
			
			otherpos = dir == "backward" ? { container : cont, offset : 0 } : { container : n, offset : 0 };
		}
		else
		if(dir == "backward")
			otherpos = { container : cont, position : 0 };
		else
		{
			otherpos = pos;
			pos = { container : utils.nextNodeNonDescendant(cont, top), position : 0 };
		}
		return utils.rangeHasContent(otherpos, pos); 
	}
	
		
	
	utils.commonContainer = function(sc, ec, top)
	{
		var p, res;

		p = ec;
		p.__painted = true;
		while(p && (p = utils.parentNode(p)))
			p.__painted = true;
		
		p = sc;
		while(p && !p.__painted)
			p = utils.parentNode(p);
		
		res = p;
		
		// unpaint
		p = ec;
		p.__painted = true;
		while(p && (p = utils.parentNode(p)))
			p.__painted = null;
	
		return res;
	}
    utils.firstCommonListItem = function(sAnc,eAnc)
    {
        for (posE in eAnc)
        {
            if(sAnc.indexOf(eAnc[posE]) > -1)
                return eAnc[posE]
        }
        console.log('Could not find a common container')
        return null;
    }
	
	utils.getElementPosition = function(element, fromElement) {
		var top = 0, left = 0, width = 0, height = 0, cs, i;
			fromElement = fromElement || document.body;

		if(!element ||  element.nodeType != 1)
			return null;

		cs = element.getBoundingClientRect(); // getComputedStyle(element);

		width = utils.numerify(cs.width) + utils.numerify(cs.borderLeftWidth) + utils.numerify(cs.borderRightWidth);
		height = utils.numerify(cs.height) + utils.numerify(cs.borderTopWidth) + utils.numerify(cs.borderBottomWidth);

		top += element.offsetTop || 0;
		left += element.offsetLeft || 0;
		element = element.offsetParent;

		while(element && utils.isDescendantOf(element, fromElement))
		{
			cs = element.getBoundingClientRect(); // getComputedStyle(element);
			top += element.offsetTop || 0;
			left += element.offsetLeft || 0;
			element = element.offsetParent;
		}

		return {
			x: left, y: top, width : width, height : height
		};
	};

	utils.markBranch = function(n, top, attribute, value)
	{
		n[attribute] = value;
		while(n && n != top)
		{
			n = utils.parentNode(n);
			n[attribute] = value;
		}
	}
	utils.unmarkBranch = function(n, top, attribute, value)
	{
		n[attribute] = value;
		while(n && n != top)
		{
			n = utils.parentNode(n);
			delete n[attribute];
		}
	}

	utils.onSameBranch = function(n, m, exceptEqual)
	{
		return utils.isDescendantOf(n, m, !exceptEqual) || utils.isDescendantOf(m, n, !exceptEqual);
	}
	
	// check whether child is descendant of ancestor, set orEqual to true to consider ancestor as a descendant
	utils.isDescendantOf = function(child, ancestor, orEqual) {
		var pp = child;

		if(child == ancestor)
			return orEqual;
		
		while(pp && pp != document.body) 
		{
			if(pp == ancestor)
				return true;
			
			pp = utils.parentNode(pp);
		}
		return false;
	};


	// modified code by Tim Down http://stackoverflow.com/questions/6846230/coordinates-of-selected-text-in-browser-page
	// returns {x : x, y : y} of the current coordinates
	utils.getSelectionCoords = (function () {
		var spareSpan = document.createElement("span");
		spareSpan.appendChild( document.createTextNode("\u200b") );
		spareSpan.classList.add('__moignore'); // to be ignored by mutation observer

		return function _getSelectionCoords(win)
		{
			win = win || window;
			var doc = win.document, offsetParent, oldVal;
			var sel = doc.selection, range, rects, rect;
			var x = 0, y = 0, spanParent, sid, eid;
			if (sel) {
				if (sel.type != "Control") {
					range = sel.createRange();
					range.collapse(true);
					x = range.boundingLeft;
					y = range.boundingTop;
				}
			} else if (win.getSelection) {
				//sel = win.getSelection();
				range = utils.getSelectionRange();
				if (range) {
					//range = sel.getRangeAt(0).cloneRange();
					/*if (range.getClientRects) {
						range.collapse(true);
						rects = range.getClientRects();
						if (rects.length > 0) {
							rect = rects[0];
						}
						if(rect)
						{
							x = rect.left;
							y = rect.top;
						}
					}*/
					if(range.startContainer.nodeType == 1)
						span = range.startContainer;
					else
					if(range.startContainer.nodeType == 3 && range.startOffset == 0)
						span = range.startContainer.parentNode;
					else
						span = spareSpan;

					// Fall back to inserting a temporary element
					if (x == 0 && y == 0) {
						if (span.getClientRects) {
							if(!span)
								range.insertNode(span = spareSpan);

							y = span.offsetTop;
							x = span.offsetLeft;

							offsetParent = span;
							while(offsetParent = offsetParent.offsetParent)
							{
								y += offsetParent.offsetTop
								x += offsetParent.offsetLeft
							}

							if(spareSpan.parentNode)
							{
								(spanParent = spareSpan.parentNode).removeChild(spareSpan);
								// Glue any broken text nodes back together
								spanParent.normalize();
								spanParent.noChange = true;
							}

						}
					}
				}
			}
			//console.log({ x: x, y: y });
			return { x: x, y: y };
		}
	})()
	
	utils.identity = function(o) { return o; }
		
	/*utils.getDomPath = function(child, ancestor, top)
	{
		var p, res;
		p = child;
		res = [];
		
		while(p && p != top)
		{
			res.push(p);
			p = utils.parentNode(p);
		}
		
		return res;
	}*/

	utils.getDomPath = function(child, parent, top, criteria)
	{
		var path = getDomPath
		while(p = utils.parentNode(c))
			if(criteria(p))
				path.push(p)
	}

	utils.hasContainers = function(node) {
		return utils.visitNodes(node, function(n, meta, prev) { 
			return prev || ir.textarea.utils.isNonCustomContainer(n) 
		})
	}
	
	// visitor takes: n, meta, prevRes
	utils.visitNodes = function(root, visitor, opts, meta, prevRes) {
		var n = root, cn, r, prevRes;

		meta = meta || {};
		meta.numericPath = meta.numericPath || [];

		if(!opts) opts = {};

		if(!opts.noRoot) r = visitor(n, meta, prevRes)
		
		cn = Polymer.dom(n).childNodes;
		if(!cn || !cn.length)
		  return r;

		opts.noRoot = false;

		//r = prevRes;
		Array.prototype.forEach.call(cn, function(el, i) {
			meta.numericPath.push(i);
			r = utils.visitNodes(el, visitor, opts, meta, r)
			meta.numericPath.pop(i);
		});
		
		return prevRes || r;
	}

	// prepare editor area replacing double spaces with ` &nbsp;`-s
	utils.prepareWhitespace	= function(e)
	{
		utils.visitNodes(e, function(n) {
			if(n.nodeType == 3 && utils.isInLightDom(n, e) && !utils.isTransitionalElement(utils.parentNode(n)))
				n.textContent = n.textContent.replace(/\s/, " ").replace(/[\s\n\t]{2}/gm, " \xa0").replace(/^\s/, "\xa0").replace(/\s$/, "\xa0");
		});
	}

	utils.isTransitionalElement = function(el) {
		return el && el.tagName && TRANSITIONAL_ELEMENTS.indexOf(el.tagName) > -1
	}
	
	utils.isSubTransitionalElement = function(el) {
		return el && el.tagName && SUBTRANSITIONAL_ELEMENTS.indexOf(el.tagName) > -1
	}

	// this one exceptionally checks the parent 
	utils.isLayoutElement = function(el) {
		var p;

		return 	el && 
				(el.tagName && LAYOUT_ELEMENTS.indexOf(el.tagName) > -1) || 
				(el.nodeType == 3 && (p = utils.parentNode(el)) && LAYOUT_ELEMENTS.indexOf(p.tagName) > -1)
	}

	utils.isSpecialElement = function(el) {
		return el && el.is && el;
	}

	utils.selfOrLeftmostDescendantIsSpecial = function(el) {
		var n;

		if(!el)
			return el;

		if(utils.isSpecialElement(el))
			return el;

		// skip empty text nodes
		n = el.firstChild;
		while(n && (n.nodeType == 3 && !n.textContent))
			n = n.nextSibling;

		// go recursive
		if(n)
			return utils.selfOrLeftmostDescendantIsSpecial(n);
	}

	utils.isParagraph = function(el) {
		return el && el.tagName == 'SPAN' && el.classList.contains('paragraph');
	}

	utils.isEmptyParagraph = function(el) {
		return el && el.matches && el.matches('span.paragraph') && (!el.firstChild || (el.firstChild && el.firstChild.tagName == 'BR'));
	}

	utils.newEmptyClone = function (el) {
		var c = Polymer.dom(el).cloneNode();
		Polymer.dom(c).appendChild(document.createElement('br'))
		return c;
	}
	
	utils.newEmptyParagraph = function (nobr) { 
		var el; 
		el = document.createElement('span'); 
		
		if(!nobr) 
			el.appendChild(document.createElement('br')); 
		
		el.classList.add("paragraph"); return el 
	},

	utils.wrapInParagraph = function(el) {
		var el, p = newEmptyParagraph(true);
		el.parentNode.insertBefore(p, el);
		el.parentNode.removeChild(el);
		p.appendChild(el)
		return p;
	},
	
	utils.mergeNodes = function (left, right, setCaretAtMergePoint) {
		var caretPos, ret, t, p, l, r, offset, atText;

		if(Polymer.dom(left).nextSibling != right)
		{
			t = left
			left = right;
			right = t;
			if(Polymer.dom(right).nextSibling != left)
				throw new Error(left + " " + right + ' are not neighbours')
		}
		
		caretPos = utils.getLastCaretPosition(left);

		if(left.nodeType == 1) // left <-- right
		{

			if(!utils.canHaveChildren(left))
				left = left.parentNode

			if(right.nodeType == 1) // element - element
			{
				t = Polymer.dom(left).lastChild; 
				
				if(t && t.tagName == 'BR')
					Polymer.dom(left).removeChild(t)
				
				
				if(Polymer.dom(left).lastChild && Polymer.dom(left).lastChild.nodeType == 3)
					ret = { container : Polymer.dom(left).lastChild, offset : Polymer.dom(left).lastChild.textContent.length };
				else
				if(Polymer.dom(right).firstChild)
					ret = { container : Polymer.dom(right).firstChild, offset : 0 };

				while(Polymer.dom(right).firstChild)
				{					
					Polymer.dom(left).appendChild(Polymer.dom(right).removeChild(Polymer.dom(right).firstChild));
					Polymer.dom.flush();
				}

				Polymer.dom(Polymer.dom(right).parentNode).removeChild(right);
			}
			else					// element - text
				Polymer.dom(left).appendChild(Polymer.dom(Polymer.dom(right).parentNode).removeChild(right));

			Polymer.dom.flush();
			if(setCaretAtMergePoint)
				utils.setCaretAt(ret.container, ret.offset);

		}
		else
		{
			caretPos.container = right; // offset won't change because it's still the length of left

			if(right.nodeType == 1)	// left -> right
			{
				r = Polymer.dom(right);
				l = Polymer.dom(left);

				Polymer.dom(l.parentNode).removeChild(left);

				if(r.firstChild)
				{
					Polymer.dom.flush();
					r.insertBefore(l.node, r.firstChild);
				}
				else
				{
					Polymer.dom(l.parentNode).removeChild(left)
					r.appendChild(l.node);
				}
				
				ret = { container : l.node, offset : l.node.textContent.length }
				
			}
			
		}
		
		if(utils.atText(ret, 'end'))
		{
			left = ret.container
			right = Polymer.dom(left).nextSibling || {};
			ret = null;
		}
		
		if(!ret && left.nodeType == 3 && right.nodeType == 3) // text - text
		{
			offset = left.textContent.length;
			left.textContent = left.textContent + right.textContent;

			utils.removeFromParent(right);
			ret = { container : left, offset : offset };
		}
		else
		if(!ret)
			ret = { container : right, offset : 0 }

		if(setCaretAtMergePoint)
			utils.setCaretAt(ret.container, ret.offset);
		
		//ret.container.normalize();
		Polymer.dom.flush();
		
		return ret;
	}	
		
	utils.isInlineElement = function(el) {
		return el && el.tagName && INLINE_ELEMENTS[el.tagName];
	}
	
	utils.sameParent = function(e1, e2)
	{
		return Polymer.dom(e1).parentNode == Polymer.dom(e2).parentNode
	}
	
	utils.sameNonCustomContainer = function(el1, el2, top, excludeTop) {
		return utils.getNonCustomContainer(el1, top, excludeTop) == utils.getNonCustomContainer(el2, top, excludeTop);
	}

	utils.isContainer = function(el) {
		return utils.isParagraph(el) || (utils.canHaveChildren(el) && !utils.isInlineElement(el) && !utils.isSpecialElement(el))
	}

	utils.isTag = function(el, tag) {
		return el && el.tagName == tag;
	}
	
	utils.removeFromParent = function(c) 
	{
		var p = Polymer.dom(c).parentNode;
		
		if(!p)
			return;

		Polymer.dom(Polymer.dom(c).parentNode).removeChild(c);
		Polymer.dom.flush();
		return c;
	}
	
	utils.moveChildrenToFragment = function(el)
	{
		var f = document.createDocumentFragment();
		while(Polymer.dom(el).firstChild)
			f.appendChild(Polymer.dom(el).removeChild(Polymer.dom(el).firstChild));
		
		Polymer.dom.flush();
		return f;
	}

	utils.copyChildrenToFragment = function(el, del)
	{
		var f = document.createDocumentFragment(), i, cn;
		cn = Polymer.dom(el).childNodes;
		for(i = 0; i < cn.length; i++)
			f.appendChild(Polymer.dom(cn[i]).cloneNode(true));
		return f;
	}
	
	utils.childrenToFragment = function(el) {
		var pel = Polymer.dom(el), frag;
	
		frag = document.createDocumentFragment();
		while(pel.firstChild)
			frag.appendChild(pel.firstChild);
		
		return frag;
	}
	
	utils.replaceWithOwnChildren = function(el)
	{
		var cn, op, p, next, i, pel, first, frag;
		
		p = Polymer.dom(utils.parentNode(el));
		
		frag = utils.childrenToFragment(el);
		first = frag.firstChild;
		try
        {
		  p.insertBefore(frag, el);
        }
        catch(err)
        {
                console.log('Failed to insert node after fragment ' +  el + ' ' + frag);
        }
		utils.removeFromParent(el);
	
		return first;
	}
	
	utils.numerify = function(x) {
		if(typeof x == 'undefined' || !x)
			return 0;

		if(typeof x == 'number')
			return x;

		return Number(x.replace ? x.replace(/[^\d\.]/g, '') : x);
	};
	
	utils.swapScripts =function(d) {
		var clone, attrs, pn;
		
		var s = Polymer.dom(d).querySelectorAll('script'), i;
		
		for(i = 0; i < s.length; i++)
		{
			clone = document.createElement('script');
			clone.appendChild(document.createTextNode(s[i].textContent));
			attrs = Array.prototype.slice.call(s[i].attributes);
			attrs.forEach(function(a) { clone.setAttribute(a.name, a.value); });

			pn = Polymer.dom(s[i]).parentNode; //Polymer.dom(s[i]).parentNode;

			if(!pn)
				return;

			Polymer.dom(pn).insertBefore(clone, s[i]);
			Polymer.dom(pn).removeChild(s[i]);
		}
		
		return s.length;
	}

	utils.childNodes = function(p) {
		if(p.is)
			return Polymer.dom(p).childNodes;
		
		else 
			return p.childNodes;
	}
    utils.ancestors = function(p){
        var a = [];
        if(Polymer.dom(p))
        {
            while(p != document.body)
            {
                p = Polymer.dom(p).parentNode;
                a.push(p);
            }
        }
        return a;                
    }
	
	var debounceCache = {};
	utils.debounce = function(f, ms, prevTimeout) {
		var save, t, refName = prevTimeout;
		
		save = typeof refName == 'string';
		if(save)
			prevTimeout = debounceCache[prevTimeout];

		if(prevTimeout)
			clearTimeout(prevTimeout);

		t = setTimeout(f, ms);
		
		if(save)
			debounceCache[refName] = t;

		return t;
	};
	
	utils.getSelectionRange = function() {
		var sel, range;
		if (window.getSelection) {
			sel = window.getSelection();
			if (sel.getRangeAt && sel.rangeCount) {
				range = sel.getRangeAt(0);
			}
		} else if (document.selection && document.selection.createRange) {
			range = document.selection.createRange();
		}

		return range ? utils.normalizeRange(range) : null;
	}
	
	utils.normalizeRange = function(r) {
		r = utils.shortcutRange(r);
		
		if(r.sc.isCaret)
		{
			r.nsc = r.nec = r.sc._host;
			r.nso = r.neo = utils.getChildPositionInParent(r.sc._host);
			
			return r
		}
		
		if(r.sc.nodeType == 3 || !r.sc.childNodes[r.so] || r.sc.childNodes[r.so].is) 
			r.nsc = r.sc, r.nso = r.so; 
		else 
			r.nsc = r.sc.childNodes[r.so], r.nso = 0;
		
		if(r.ec.nodeType == 3 || !r.ec.childNodes[r.eo] || r.ec.childNodes[r.eo].is) 
			r.nec = r.endContainer, r.neo = r.eo; 
		else 
			r.nec = r.sc.childNodes[r.so], r.neo = 0;

		return r;
	}

	utils.shortcutRange = function(range) {
		range.sc = range.startContainer;
		range.so = range.startOffset;
		range.ec = range.endContainer;
		range.eo = range.endOffset;
		
		return range;
	}
	
	// returns firstChild if it's the only one
	utils.singleChildNode = function(el) {
		if(el.childNodes && el.childNodes.length == 1)
			return el.firstChild
			
	}
    utils.cloneNodeWithProperties = function(el)
    {
        newElement = el.cloneNode(true);
        for(var i in el.properties) 
        {
            newElement[i] = el[i]
        }
        return newElement;
    }

	return utils;
})();


