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
			stopPoints : "EDITOR>IS,*>EMPTYTEXT,IS||!TEXT,EMPTYTEXT||NCBLOCK,P>IS,CONTED>TEXT,NCBLOCK||NCBLOCK",
			skipPoints : "TEXT|TRANS,IS>>!CONTED,*>>EDITOR,*||SHADOW,P||TEXT,INLINECONT||TEXT,INLINECONT>INLINECONT,TRANS>|*"
		};
	
	ir.textarea.CaretNavigator = 	
	CaretNavigator = function(editor, opts) {
		this.editor = editor;
		this.log = opts.log || function() {};
		if(this.log === true)
			this.log = function() { 
				console.log(Array.prototype.slice.call(arguments).join(' ')); 
			};
		
		this.caretSpan = opts.caretSpan;
		this.caretSpanShow = opts.caretSpanShow;
		this.caretSpanHide = opts.caretSpanHide;
		
		this.updateRules(rulesetsDef, editor);
	}

	CaretNavigator.prototype.Symbols = Symbols;
	CaretNavigator.prototype.rulesetsDef = rulesetsDef;
	
	// given a container and and offset returns the next legit caret position
	CaretNavigator.prototype.forward = function(container, offset)
	{
		var c = container, o = offset, m, n, match, skipMatch,
			e = this.editor;

		if(c == e.lastChild && c.nodeType == 3 && o == c.textContent.length)
			return { container : c, offset : c.textContent.length }
			
		if((c == e && c.childNodes[o]))
		{
			c = c.childNodes[o];
			o = 0;
		}

		if(!c)
			return;
			
		if(c.nodeType == 3 && o < c.textContent.length)
			return { container : c, offset : o + 1}

		if(c == e.nextSibling || (c == e && o == e.childNodes.length))
			return { container : e, offset : e.childNodes.length };

		n = c;
		
		while(n && n != e.nextSibling) {
			n = utils.nextNode(n, this.editor);
			
			if(!n)
				return null;
				
			m = n.previousSibling || utils.parentNode(n);

			if(m == editor || (n == e && o == e.childNodes.length))
				return { container : c, offset : o };

			// non-end of textNode
			if(n.nodeType == 3 && !this.rulesets.skipPoints(null, n))
				return { container : n, offset : Symbols.INLINECONT(m) ? 1 : 0 }
			
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
		return { container : e, offset : e.childNodes.length };
	}

	// given a container and and offset returns the previous legit caret position
	CaretNavigator.prototype.backward = function(container, offset)
	{
		var c = container, o = offset, m, n, match,
			e = this.editor;
		
		if(c == e && c.childNodes[o])
		{
			c = c.childNodes[o];
			o = 0;
		}	

		if(c == e.firstChild && o == 0)
			return { container : c, offset : o };		
		
		// non-beginning of textnode
		if(c.nodeType == 3 && o > 0)
			return { container : c, offset : o - 1 }

		if(c == e && o == 0)
			return { container : c, offset : 0 };
			
		n = c;
		while(n && n != e) {
			n = utils.prevNode(n);
			m = n.previousSibling || utils.parentNode(n);
			
			if(n.nodeType == 3 && !this.rulesets.skipPoints(null, n))
				return { container : n, offset : n.textContent.length - (Symbols.INLINECONT(m) ? 1 : 0) };
					
			if(m && m.nodeType == 3 && m.textContent && utils.isInLightDom(m, this.editor) && !this.rulesets.skipPoints(null, m))
				return { container : m, offset : m.textContent.length - (m && m.nextSibling == n && Symbols.INLINECONT(n) ? 1 : 0) };
			
			// a stop
			if(match = this.rulesets.stopPoints(m, n))
			{
				if(!this.rulesets.skipPoints(m, n))
				{
					if(n.nodeType == 3)
						return { container : n, offset : n.textContent.length }

					return { container : n, offset : 0, caretRule : match }
				}
			}		
			// n = utils.prevNode(n);
		}

		// end
		return { container : e, offset : e.childNodes.length };
	}
	
	CaretNavigator.prototype.stopFastGo = function() {
		clearTimeout(this.fftimeout)
	}
	
	// three signatures:
	// go(direction, fast): direction is "forward" or "backward"
	// go(direction, rangeSide): rangeSide is "start" or "end", default is "start"
	// go(pos): where pos = {container : `dom node`, offset : o : `offset` }.
	// return value: next pos: { container : `dom node`, offset : `offset` }
	CaretNavigator.prototype.go = function(direction, fastOrRangeSide)
	{
		var r, next, sel, pn, index, c, o, pos, childAtPos, 
		caretSpan = this.caretSpan,
		fast = typeof fastOrRangeSide == 'boolean' && fastOrRangeSide,
		rangeSide = typeof fastOrRangeSide == 'string' && fastOrRangeSide;
		
		if(caretSpan && caretSpan.parentNode)
		{
			this.virtualCaret = false;

			if(this.caretSpanHide)
				this.caretSpanHide();
			else
			{
				index = utils.getChildPositionInParent(caretSpan);
				
				pn = caretSpan.parentNode;
				pn.removeChild(caretSpan);
				
				for(i = 0; i < pn.childNodes.length; i++)
					if(pn.childNodes[i].nodeType == 3 && !pn.childNodes[i].textContent.length)
						pn.removeChild(pn.childNodes[i]);
				
				c = pn, o = index;

				childAtPos = pn.childNodes[o];
				if(childAtPos) // && !childAtPos.is)
				{
					c = childAtPos;
					o = 0;
				}
			}
		}

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
				
				c = r.startContainer, o = r.startOffset;
			}
			
			if(!utils.isInLightDom(c, this.editor))
			{
				c = utils.getTopCustomElementAncestor(c, this.editor);
				o = 0;
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
	
	CaretNavigator.prototype.setAt = function(container, offset, rangeSide) {
		var r = utils.getSelectionRange(), c, o;
		
		// console.log("setAt: ", container, offset, rangeSide)
		
		if(container.nodeType != 3)
		{			
			this.virtualCaret = true;
		
			if(this.caretSpanShow)
				return this.caretSpanShow(container, offset, rangeSide)

			container.parentNode.insertBefore(this.caretSpan, container);

			c = this.caretSpan.firstChild;
			o = 0;
		}
		else
		{
			c = container;
			o = offset;
		}
		
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