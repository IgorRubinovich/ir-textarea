// dom/range utility functions

if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.utils = (function() {
	var utils = {};
	
	var INLINE_ELEMENTS = {};
	
	"font,b,big,i,small,tt,abbr,acronym,cite,code,dfn,em,kbd,strong,samp,time,var,a,bdo,br,img,map,object,q,script,span,sub,sup".split(/,/)
		.forEach(function(tag) { INLINE_ELEMENTS[tag.toUpperCase()] = true });
		
	var TRANSITIONAL_ELEMENTS = ['UL', 'TABLE', 'TBODY', 'TH', 'TR'];
		
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
		if(!node)
			return false;

		if(node.parentNode == top || (includeTop && node == top))
			return true;

		if(node != top && node != document.body)
			return utils.isInLightDom(Polymer.dom(node).parentNode, top);

		return false;
	}

	// returns topmost custom element or null below or equal to `top`
	utils.getTopCustomElementAncestor = function(node, top) {
		var res = null;
		if(!top) top = document.body;

		while(node && node != top)
		{
			if(node.is)
				res = node;

			if(Polymer.dom(node).parentNode != node.parentNode && !utils.isInLightDom(node, top))
				node = Polymer.dom(node).getOwnerRoot().host;
			else
				node = node.parentNode;
		}

		return (node == top) ? res : null;
	}

	utils.getChildPositionInParent = function(child, withDelimiters, withoutCaret) {
		var i, cn, p, pos = 0, caret = 0;
		if(!child || child == document.body)
			return null;

		if(child.isCaret)
		{
			p = child.hostMarker.parentNode;
			cn = p.childNodes;
		}
		else
		if(Polymer.dom(child).getOwnerRoot() == Polymer.dom(child.parentNode).getOwnerRoot())
		{
			p = child.parentNode;
			cn = p.childNodes;
		}
		else
		{
			p = Polymer.dom(child).parentNode;
			cn = Polymer.dom(p).childNodes
		}
		
		if(!p)
			return null;
		
		i = -1;
		while(cn[++i] != child)
			if(cn[i].isCaret)
				caret = 1;

		return i - (withoutCaret ? caret : 0);
	}

	utils.getChildPathFromTop = function(child, top, withDelimiters) {
		var t, p;

		if(!child || (child == document.body && top != document.body) )
			return null;
		if(child == top)
			return [];

		p = child.parentNode;
		if(Polymer.dom(child).parentNode != p && !utils.isInLightDom(p, top))
			p = Polymer.dom(child).parentNode;

		t = utils.getChildPathFromTop(p, top, withDelimiters);
		if(!t)
			return null;
		t.push(utils.getChildPositionInParent(child, withDelimiters));
		return t;
	}

	utils.getChildFromPath = function(pathArr, top, descend)
	{
		var res = top, i = 0, next;

		descend = descend || 0;
		
		if(!pathArr)
			return null;

		while(i < pathArr.length - descend)
		{
			if(pathArr[i] || pathArr[i] === 0)
				next = (res.is ? Polymer.dom(res) : res).childNodes[pathArr[i]];

			if(!next)
				return null; // res;

			res = next;
			
			i++;
		};

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

		//console.log('setting caret at:', startTarget, startOffset, endTarget, endOffset);
		/*try {
			throw new Error('')
		}
		catch(e)
		{
			console.log(e.stack)
		}*/
		
		if(!endTarget)
		{
			endTarget = startTarget;
			endOffset = startOffset;
		}

		if(currentrange &&
			(currentrange.startContainer == range.startContainer && 
			currentrange.startOffset == range.startOffset) && 
			( currentRange.collapsed || (
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

	/*utils.nextNode = function(node, excludeChildren) {
		if(node.is)
			node = Polymer.dom(node);

		if(!excludeChildren && node && (Polymer.dom(node).childNodes && Polymer.dom(node).childNodes.length)) {
			return node.firstChild;
		} else {
			while (node && node != top && !Polymer.dom(node).nextSibling) {
				node = Polymer.dom(node).parentNode;
			}
			if (!node) {
				return null;
			}
			return Polymer.dom(node).nextSibling;
		}
	}*/

	utils.nextNode = function(node, top) {
		if(!node)
			return;
		
		if(node.is)
			node = Polymer.dom(node);

		if(Polymer.dom(node).childNodes && Polymer.dom(node).childNodes.length)
			return Polymer.dom(node).firstChild;

		while (node && node != top && !Polymer.dom(node).nextSibling) // !Polymer.dom(node).nextSibling) {
			node = Polymer.dom(node).parentNode;

		if (!node)
			return null;
		
		return node.nextSibling;
	}

	utils.prevNode = function(node, top, opts) {
		var pn;

		if(!opts) opts = {};

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

				pn = pn.previousSibling;
			}
		}
		else
			pn = node.previousSibling

		if(pn.nodeType == 3)
			return pn;

		while(Polymer.dom(pn).lastChild && (!opts.atomicCustomElements || !pn.is))
			pn = Polymer.dom(pn).lastChild;

		return pn;
	}
	
	utils.parentNode = function(node, top) {
		if(node.parentNode == top)
			return top;

		if(Polymer.dom(node).parentNode != node.parentNode && utils.isInLightDom(node, top)) // && !utils.isInLightDom(node.parentNode, top))
			return Polymer.dom(node).parentNode;
		else
			return node.parentNode;
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
			}

			return pos || { container : node, offset : node.nodeType == 3 ? node.textContent.length : 0 };
		}
		else
			return { container : node, offset : node.textContent.length }
	};

	/*
		splits a node at offset

		params:

		node - the node to split
		offset - in the splitted node,
		limit - the root of the split.
	*/
	utils.splitNode = function(node, offset, limit) {
		var parent = limit.parentNode,
			parentOffset = utils.getChildPositionInParent(limit),
			doc = node.ownerDocument,
			left,
			leftRange = doc.createRange(), clone;

		leftRange.setStart(parent, parentOffset);
		leftRange.setEnd(node, offset);
		left = leftRange.extractContents();
		parent.insertBefore(left, limit);

		//Polymer.dom.flush();
		
		utils.visitNodes(limit.previousSibling, function(el) {  // hard-reattach custom elements lest they lose their powers
			var h;
			if(el.is)
			{
				//h = document.createDocmentFragment(); // other ways don't cause the element to get reinitialized - the whole element must be completely rewritten
				//h.innerHTML = utils.recursiveOuterHTML(el);
				//el.parentNode.insertBefore(h.firstChild, el);
				clone = Polymer.dom(el).cloneNode(false);
				Polymer.dom(clone).innerHTML = utils.recursiveInnerHTML(el);
				el.parentNode.insertBefore(clone, el);
				el.parentNode.removeChild(el);
				Polymer.dom.flush();
			}
		})

		left.normalize();
		limit.normalize();

		return limit;
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

	// check whether child is descendant of ancestor, set orEqual to true to consider ancestor as a descendant
	utils.isDescendantOf = function(child, ancestor, orEqual) {
		var pp;

		if(child == ancestor)
			return orEqual;
		
		while(child && child != document.body)
		{
			pp = Polymer.dom(child).parentNode;
			if(child.parentNode == ancestor || (pp && pp.parentNode == ancestor))
				return true;
			else
				child = (child.parentNode == pp ? child.parentNode : (utils.isInLightDom(child, ancestor) ? pp : Polymer.dom(child).getOwnerRoot().host));

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
	
	utils.caretIsAtContainerEnd = function() {
		var r = getSelectionRange(),
			maxOffset = (r.startContainer.length || (r.startContainer.childNodes && r.startContainer.childNodes.length))
			i;

		if(r.startOffset >= maxOffset) return true;

		if(r.startContainer.nodeType == 3)
			return /^\s*$/.test(r.startContainer.textContent.substr(r.startOffset, maxOffset));

		return false
	}

	utils.caretIsAtContainerStart = function() {
		var r = getSelectionRange(),
			i;

		if(r.startOffset == 0) return true;

		if(r.startContainer.nodeType == 3)
			return /^\s*$/.test(r.startContainer.textContent.substr(0, r.startOffset));

		return false
	}
	
	utils.visitNodes = function(root, visitor, opts, meta) {
		var n = root;

		meta = meta || {};
		meta.numericPath = meta.numericPath || [];

		if(!opts) opts = {};

		if(!opts.noRoot) visitor(n, meta)
		if(!n.childNodes || !n.childNodes.length)
		  return;

		opts.noRoot = false;


		Array.prototype.forEach.call((n.is ? Polymer.dom(n) : n).childNodes, function(el, i) {
			meta.numericPath.push(i);
			utils.visitNodes(el, visitor, opts, meta)
			meta.numericPath.pop(i);
		});
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
		return el && el.matchesSelector && el.matchesSelector('span.paragraph') && el.firstChild && el.firstChild.tagName == 'BR';
	}

	utils.newEmptyParagraph = function (nobr) { 
		var el; el = document.createElement('span'); if(!nobr) el.appendChild(document.createElement('br')); el.classList.add("paragraph"); return el 
	},

	utils.wrapInParagraph = function(el) {
		var el, p = newEmptyParagraph(true);
		el.parentNode.insertBefore(p, el);
		el.parentNode.removeChild(el);
		p.appendChild(el)
		return p;
	},

	utils.mergeNodes = function (left, right, setCaretAtMergePoint) {
		var caretPos, ret, t;

		ret = caretPos = utils.getLastCaretPosition(left);

		if(left.nodeType == 1) // left <-- right
		{

			if(!utils.canHaveChildren(left))
				left = left.parentNode

			if(right.nodeType == 1) // element - element
			{
				while(right.firstChild)
				{
					if(right.firstChild.is)
					{
						// got to do this to force custom elements rendered after merge
						h = utils.recursiveOuterHTML(right.firstChild);
						t = document.createElement('div');
						right.removeChild(right.firstChild);
						left.appendChild(t); 
						t.outerHTML = h;
					}
					else
						left.appendChild(right.removeChild(right.firstChild));
				}

				right.parentNode.removeChild(right);
			}
			else					// element - text
				left.appendChild(right.parentNode.removeChild(right));

			if(setCaretAtMergePoint)
				utils.setCaretAt(caretPos.container, caretPos.offset);

			ret = left;
		}
		else
		{
			caretPos.container = right; // offset won't change because it's still the length of left

			if(right.nodeType == 1)	// left -> right
			{
				if(right.firstChild)
					right.insertBefore(left.parentNode.removeChild(left), right.firstChild);
				else
					right.appendChild(left.parentNode.removeChild(left));
			}
			else 				// text - text
			{
				right.textContent = left.textContent + right.textContent;
				left.parentNode.removeChild(left);
			}

			ret = right;
		}

		if(setCaretAtMergePoint)
			utils.setCaretAt(caretPos.container, caretPos.offset);
		
		return ret;
	}	
		
	utils.isInlineElement = function(el) {
		return el && el.tagName && INLINE_ELEMENTS[el.tagName];
	}

	utils.isContainer = function(el) {
		return utils.isParagraph(el) || (utils.canHaveChildren(el) && !utils.isInlineElement(el) && !utils.isSpecialElement(el))
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

	return utils;
})();

