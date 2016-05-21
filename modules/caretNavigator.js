/*
	Caret navigator with custom elements support.
	
	Initialize:
	
	var cn = CaretNavigator(editor, opts)
	
	`editor`			- the containing element providing navigation boundaries

	`opts` may include the following options:
		opts.caretSpan 	   	- an element or an object to use as a caret in places where standard caret will not be visible (used with go)
		opts.caretSpanShow 	- a custom method to show caretSpan
		opts.caretSpanHide 	- a custom method to hide caretSpan
		opts.log 			- a custom function to use for debug output. If set to boolean true will default to console.log
	
	Usage:
	
		cn.forward(container, offset); 		// returns a range-like obj with obj.container and obj.offset representing the next legit caret position
		cn.backward(container, offset);		// returns a range-like obj with obj.container and obj.offset representing the previous legit caret position
		
		cn.go(direction, fast); 			// direction is "forward" or "backward". Moves the caret in the given direction adding opts.caretSpan where required.
											// returns the resulting position in a range-like object (see forward/backward).
								
		cn.go({ container : c, offset : o}) // sets the caret at given position inserting opts.caretSpan if required and setting the caret there
											// returns the resulting position in a range-like object (see forward/backward)

	Note: the 'resulting position' in calls above is always the position of the caret that would have been correct if caretSpan never existed,
	e. g. when setting the caret at a custom element located at position 2 in editor, the result will be like { container : editor, offset : 2 },
	as ooposed to the real caret position which in such case would be inside caretSpan.
							
*/

(function() {
	var 
	
		Symbols = ir.textarea.CaretRulesets.Symbols,
		utils = ir.textarea.utils,

		// a bunch of rules that define where the caret should stop - see caretRules.js for details
		rulesetsDef = {
			stopPoints : 	"PEMPTY>*,EDITOR>IS,*>EMPTYTEXT,NCCONT>NULL,IS||!TEXT," + 
							"EMPTYTEXT||NCBLOCK,P>IS,CONTED>TEXT,NCBLOCK||NCBLOCK," +
							"NCBLOCK||NULL,CONT|NCBLOCK,CONTED>NCBLOCK",

			skipPoints : "*+CARET,*+SHADOW,TEXT|TRANS,IS>>!CONTED,*>>EDITOR,*||SHADOW,P||TEXT,INLINECONT||TEXT,INLINECONT||INLINECONT,INLINECONT>INLINECONT,TRANS>|*",
			
			inlineTextNeighbours : "INLINECONT||TEXT,INLINECONT>TEXT",
			
			delMergeConditions 	: "TEXT||TEXT,TEXT||NCCONTBLOCK,NCCONTBLOCK||NCCONTBLOCK",
			delPullConditions 	: "NCCONTBLOCK||TEXT,NCCONTBLOCK||NCBLOCK,NCCONT||IS"
		};
	
	ir.textarea.CaretNavigator = 	
	CaretNavigator = function(editor, opts) {
		this.editor = editor;
		this.log = opts.log || function() {};
		if(this.log === true)
			this.log = function() { 
				this.log(Array.prototype.slice.call(arguments).join(' ')); 
			};
		
		this.caretSpan = opts.caretSpan;
		this.caretSpanShow = opts.caretSpanShow != false && (opts.caretSpanShow || this.defaultCaretShow);
		this.caretSpanHide = opts.caretSpanHide != false && (opts.caretSpanHide || this.defaultCaretHide);
		
		this.updateRules(rulesetsDef, editor);
	}

	CaretNavigator.prototype.Symbols = Symbols;
	CaretNavigator.prototype.rulesetsDef = rulesetsDef;
	
	// given a container and and offset returns the next legit caret position
	CaretNavigator.prototype.forward = function(container, offset)
	{
		var c = container, o = offset, m, n, match, skipMatch, prev,
			e = this.editor, cn;

		// this is required or we will always be looking from first child regardless of offset
		if(c.nodeType == 1 && (cn = utils.childNodes(c))[o] && o > 0)
		{
			c = cn[o];
			o = 0;
		}

		if(c == e.lastChild && c.nodeType == 3 && o == c.textContent.length)
			return { container : c, offset : c.textContent.length }
			
		if((c == e && Polymer.dom(c).childNodes[o]))
		{
			c = Polymer.dom(c).childNodes[o];
			o = 0;
		}

		if(!c)
			return;
			
		if(c.nodeType == 3 && o < c.textContent.length)
			return { container : c, offset : o + 1}

		if(c == Polymer.dom(e).nextSibling || (c == e && o == Polymer.dom(e).childNodes.length))
			return { container : e, offset : Polymer.dom(e).childNodes.length };
		
		n = c;
		
		while(n && n != Polymer.dom(e).nextSibling) {
			prev = n;
			
			if(!Symbols.CONT && Symbols.CONT(Polymer.dom(n.parentNode)))
				return { container : Polymer.dom(n.parentNode), offset : Polymer.dom(n.parentNode).childNodes.length }
		
			n = utils.nextNode(n, this.editor);
			
			if(!n)
				return { container : this.editor, offset : Polymer.dom(this.editor).childNodes.length };;
				
			m = Polymer.dom(n).previousSibling || utils.parentNode(n, this.editor);

			if(m == editor || (n == e && o == Polymer.dom(e).childNodes.length))
				return { container : c, offset : o };

			// non-end of textNode
			
			if(n.nodeType == 3 && !this.rulesets.skipPoints(null, n))
				return {
					container : n,
					offset : 	(this.rulesets.inlineTextNeighbours(m, n) || this.rulesets.inlineTextNeighbours(m.previousSibling, m)) &&
								utils.sameNonCustomContainer(prev,n)
								? 1 : 0 
				}
			
			
			if(m && m != c && m.nodeType == 3 && m.textContent && utils.isInLightDom(m, this.editor) && !this.rulesets.skipPoints(null, m))
				return { container : m, offset : 0 };
			
			// a stop
			if(match = this.rulesets.stopPoints(m, n))
			{
				skipMatch = this.rulesets.skipPoints(m, n);
				if(!skipMatch)
				{
					if(n.nodeType == 3)
						return { container : n, offset : 0 }

					return { container : n, offset : 0, caretRule : match }
				}
				else
					this.log(match, " blocked by  ", skipMatch)
			}		
			//n = utils.nextNode(n);
		}

		// end
		return { container : e, offset : Polymer.dom(e).childNodes.length };
	}

	// given a container and and offset returns the previous legit caret position
	CaretNavigator.prototype.backward = function(container, offset)
	{
		var c = container, o = offset, m, n, match,
			e = this.editor, cn, temp, res, k;

		if(Polymer.dom(c.firstChild).parentNode == e) // reset to component root
			c = e;
			
		// this is required or we will always be looking from first child regardless of offset		
		if(c.nodeType == 1 && (cn = utils.childNodes(c))[o] && o > 0)
		{
			c = cn[o];
			o = c.nodeType == 3 ? c.textContent.length : 0;
		}

		if(c == e && Polymer.dom(c).childNodes[o])
		{
			c = Polymer.dom(c).childNodes[o];
			o = 0;
		}	

		if(c == e.firstChild && o == 0)
			return { container : c, offset : o };		
		
		// non-beginning of textnode
		if(c.nodeType == 3 && o > 0 &&  !this.rulesets.skipPoints(null, c))
			return { container : c, offset : o - 1 }

		if(c == e && o == 0)
			return { container : c, offset : 0 };
		
		if(c == e && o == Polymer.dom(e).childNodes.length)
			c = temp = Polymer.dom(e).appendChild(document.createElement('span'));

		n = c;
		while(!res && n && n != e) {
			m = n;
			n = utils.prevNode(n, this.editor);
			if(n == this.editor)
				res = { container : m, offset : 0 }
			
			if(!res)
				m = Polymer.dom(n).previousSibling || utils.parentNode(n, this.editor);
			
			k = Polymer.dom(n).nextSibling || Polymer.dom(n).parentNode;
			if(!res && n.nodeType == 3 && !this.rulesets.skipPoints(n, k))
				res = { container : n, offset : n.textContent.length - (Symbols.INLINECONT(k) || Symbols.TEXT(k) ? 1 : 0) };

			if(!res && (m && m.nodeType == 3 || this.rulesets.stopPoints(null, m)) && !this.rulesets.skipPoints(null, m))
			//if(m && m.nodeType == 3 && m.textContent && utils.isInLightDom(m, this.editor) && !this.rulesets.skipPoints(null, m))
				res = { container : m, offset : m.textContent.length - (m && Polymer.dom(m).nextSibling == n && Symbols.INLINECONT(n) ? 1 : 0) };
			
			// a stop
			if(!res && (match = this.rulesets.stopPoints(m, n)))
			{
				if(!this.rulesets.skipPoints(m, n))
				{
					if(n.nodeType == 3)
						res = { container : n, offset : n.textContent.length }

					res = { container : n, offset : 0, caretRule : match }
				}
			}		
			// n = utils.prevNode(n);
		}

		if(temp)
			Polymer.dom(Polymer.dom(temp).parentNode).removeChild(temp);
		
		// return result or editor end
		return res || { container : e, offset : Polymer.dom(e).childNodes.length };
	}
	
	CaretNavigator.prototype.stopFastGo = function() {
		clearTimeout(this.fftimeout)
	}
	
	CaretNavigator.prototype.goAt = function(atpos, rangeSide)
	{
		this.caretSpanHide();
		
		if(atpos.container.nodeType == 1 && !Polymer.dom(atpos.container).childNodes[atpos.offset] && 
			!utils.getTopCustomElementAncestor(atpos.container, this.editor))
		{
			this.setAt(atpos, rangeSide);
			return atpos;
		}

		if(!utils.isInLightDom(atpos))
			console.log()
		
		// flap and wibble to find the right spot
		var pos = this.forward(atpos.container, atpos.offset);
		if(pos)
			pos = this.backward(pos.container, pos.offset);
		else
			pos = { container : this.editor, offset : Polymer.dom(this.editor).childNodes.length }
		
		this.setAt(pos, rangeSide);
		
		return pos;
	}
	
	CaretNavigator.prototype.goFrom = function(pos, direction, rangeSide)
	{
		this.caretSpanHide();
		
		var pos = this[direction](pos.container, pos.offset);
		
		this.setAt(pos, rangeSide);
		
		return pos;
	}
	
	CaretNavigator.prototype.defaultCaretShow = function(container, offset, rangeSide)
	{
		Polymer.dom(container).parentNode.insertBefore(this.caretSpan, container);
		
		this.caretSpan.position = { container : container, offset : offset };
		
		return { container : this.caretSpan.firstChild, offset : 0 }
	}
	
	CaretNavigator.prototype.defaultCaretHide = function()
	{
		var caretSpan = this.caretSpan, index, pn;
		
		if(!Polymer.dom(caretSpan).parentNode)
			return;

		index = utils.getChildPositionInParent(caretSpan); // + (caretSpan == utils.parentNode(caretSpan, this.editor).lastChild ? 0 : 1);

		pn = Polymer.dom(caretSpan).parentNode;
		pn.removeChild(caretSpan);
		
		for(i = 0; i < Polymer.dom(pn).childNodes.length; i++)
			if(Polymer.dom(pn).childNodes[i].nodeType == 3 && !Polymer.dom(pn).childNodes[i].textContent.length)
				pn.removeChild(Polymer.dom(pn).childNodes[i]);
		
		c = pn, o = index;

		childAtPos = Polymer.dom(pn).childNodes[o];
		if(childAtPos) // && !childAtPos.is)
		{
			c = childAtPos;
			o = 0;
		}
		
		this.virtualCaret = false;
		
		return this.caretSpan.position;
	}
	
	// four signatures:
	// go(direction, fast): direction is "forward" or "backward"
	// go(direction, rangeSide): rangeSide is "start" or "end", default is "start"
	// go(pos): where pos = {container : `dom node`, offset : o : `offset` }.
	// go(pos, direction): where pos = {container : `dom node`, offset : o : `offset` }.
	// return value: next pos: { container : `dom node`, offset : `offset` }
	CaretNavigator.prototype.go = function(direction, fastOrRangeSide)
	{
		var r, next, sel, pn, index, c, o, pos, childAtPos, 
		
		fast = typeof fastOrRangeSide == 'boolean' && fastOrRangeSide,
		rangeSide = typeof fastOrRangeSide == 'string' && fastOrRangeSide;
		
		pos = this.caretSpanHide();

		if(typeof direction == 'object')
		{
			pos = direction;
			c = pos.container;
			o = pos.offset;
			
			if(!utils.isInLightDom(c, this.editor))
			{
				c = utils.getTopCustomElementAncestor(c, this.editor);
				o = 0;
			}
			
			// flap and wibble to find the right spot
			pos = this.forward(c, o);
			if(pos)
				next = this.backward(pos.container, pos.offset);
		}
		else
		{
			if(!c)
			{
				r = utils.getSelectionRange();
				
				if(!r)
					this.log('SELECTED RANGE IS OUTSIDE EDITOR');
				
				if(rangeSide != 'end')
				{
					c = r.startContainer, o = r.startOffset;
				}
				else
				{
					c = r.endContainer, o = r.endOffset;
				}
			}
						
			if(c == this.editor && o < Polymer.dom(this.editor).childNodes.length)
			{
				c = Polymer.dom(this.editor).childNodes[o]
				o = 0;
			}
			
			if(!utils.isInLightDom(c, this.editor))
			{
				c = utils.getTopCustomElementAncestor(c, this.editor);
				o = 0;
			}
			
			if(pos)
			{
				c = pos.container;
				o = pos.offset;
			}
			
			next = this[direction](c, o);
		}

		if(next)
		{
			if(document.activeElement != this.editor)
				this.editor.focus();

			this.setAt(next.container, next.offset, rangeSide);
			this.log(utils.tagOutline(next.container).trim().substring(0,10), next.offset, next.caretRule ? next.caretRule : "NO RULE" );
			//document.getElementById('elclone').innerHTML = utils.recursiveOuterHTML(next.container);
		}
		else
			this.log("NO RULE, default action")
		
		clearTimeout(this.fftimeout);
		if(fast && (!next || utils.isDescendantOf(next.container, e)))
			this.fftimeout = setTimeout(function() {
				this.go(direction, fast) 
			}.bind(this), next && next.container.nodeType == 3 ? 5 : 500);	
		
		return next;
	}

	// set range or its one side at container, offset
	// setAt(container, offset, rangeSide) or
	// setAt(pos, rangeSide) where pos.container and pos.offset are same as in the first signature
 	CaretNavigator.prototype.setAt = function(container, offset, rangeSide) {
		var r = utils.getSelectionRange(), c, o, pos;
		
		if(!container)
			return;
		
		if(typeof offset != 'number')
		{
			rangeSide = offset;
			offset = container.offset;
			container = container.container;
		}
		// console.log("setAt: ", container, offset, rangeSide)
		
		if(container.nodeType != 3)
		{			
			this.virtualCaret = true;
			pos = this.caretSpanShow(container, offset, rangeSide);
			
			if(!pos)
				return;
			
			c = pos.container;
			o = pos.offset;
		}
		else
		{
			c = container;
			o = offset;
		}
		
		if(!r)
			utils.setCaretAt(c, o);
		else
		if(rangeSide == 'start')
			utils.setCaretAt(c, o, r.endContainer, r.endOffset);
		else
		if(rangeSide == 'end')
			utils.setCaretAt(r.startContainer, r.startOffset, c, o);
		else
			utils.setCaretAt(c, o);
	}

	CaretNavigator.prototype.updateRules = function() {
		this.rulesets = new ir.textarea.CaretRulesets(rulesetsDef, this.editor);
	}	
})()