if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.inputHandlers = (function() {
	var 
		utils = window.ir.textarea.utils,
		paste = window.ir.textarea.paste,
		deletes = window.ir.textarea.deletes;
		
	return {
		updateRange : function(ev) {
			// save position on control keys
			if((ev.type == 'keyup') && ([33,34,35,36,37,38,39,40].indexOf(keyCode) > -1) || (ev.type == 'mouseup'))
				this.customUndo.pushUndo();
		},
		previewHotKey : function(ev) {
			var keyCode = ev.which || ev.keyCode;
			if(keyCode == 192 && ev.type == 'keydown' && ev.altKey && this.viewMode != 1)
			{
				document.addEventListener('keyup', previewShortcutListener = function() {
					document.removeEventListener('keyup', previewShortcutListener);
					this._prevViewMode = null;

					if(keyCode != 192)
						return;

					this.set('viewMode', this._prevViewMode || 0);
				}.bind(this));

				this._prevViewMode = this.viewMode;
				this.set('viewMode', 1);
			};
		},
		
		clearActionData : function(ev) {
			var keyCode = ev.which || ev.keyCode;
			
			if(ev.target == this.$.resizeHandler || ev.target == this.__actionData.target)
				return;
			
			// clear action data on any key except delete/backspace
			if(keyCode && !(keyCode == 8 || keyCode == 46) && !ev.ctrlKey && !ev.metaKey && !ev.altKey)
				this.clearActionData();
		},
		
		enterKey : function(ev) {
			var r, keyCode = ev.which || ev.keyCode, r, pos, n, firstRange;
	
			if(keyCode != 13)
				return;
	
			if (ev.type == 'keyup')
				return ev.preventDefault();

			// line break/paragraph
			r = this.selectionRestore();
			if(ev.shiftKey || // line break
				utils.getTopCustomElementAncestor(r.startContainer, this.$.editor) ||
				this.selectAncestor(r.startContainer, 'table', this.$.editor) ||  // need more work to enable paragraphs in tables
				utils.getTopCustomElementAncestor(r.endContainer, this.$.editor))
			{
					r = utils.getSelectionRange();

					if(r.startContainer.nodeType == 3 && (r.startContainer.length - 1 <= r.startOffset && r.startContainer.textContent.charAt(r.startOffset).match(/^ ?$/) && ((r.startContainer.nextSibling || {}).tagName != "BR")))
						firstRange = paste.pasteHtmlAtCaret.call(this, '<br>', false, true);

					paste.pasteHtmlAtCaret.call(this, '<br>', false, true);

					r = utils.getSelectionRange();
					pos = r.startOffset;

					if(firstRange && utils.isSpecialElement(r.startContainer.nextSibling))
						utils.setCaretAt(firstRange.startContainer, 0);
					else
					if(!r.startContainer.childNodes.length)
					{
					  n = r.startContainer.parentNode;
					  pos = utils.getChildPositionInParent(n);
					}
					else
					{
					  while(pos >= r.startContainer.childNodes.length) pos--;
					  n = r.startContainer;
					}
			}
			else	// new paragraph
				paste.pasteHtmlWithParagraphs.call(this, '<span class="paragraph"><br></span>', true);

			this.selectionSave();
			ev.preventDefault();
		},
		
		navigationKeys : function(ev) {
			var r, sc, se, so, eo;

			r = utils.getSelectionRange();
			
			if(!r)
				return;
			
			if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
			if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;

			var keyCode = ev.which || ev.keyCode;
			if([37,39].indexOf(keyCode) > -1) // left/right keys
			{
				// left
				if(sc && (keyCode == 37) && (so == 0 || sc.isDelimiter) && sc.nodeType == 3)
				{
					if(sc.isInTransition = (ev.type == 'keydown'))
					{
						//setCaretAt(sc.previousSibling.previousSibling, sc.previousSibling.previousSibling.textContent.length);
						if(sc.previousSibling && sc.previousSibling.is)
						{
							utils.setCaretAt(sc.previousSibling.previousSibling, sc.previousSibling.previousSibling.textContent.length);
							ev.preventDefault();
						}
						else
							utils.setCaretAt(sc, 0); // let the browser do the job, this happens at paragraph start
					}
				}
				else
				if(ec && (keyCode == 39) && (ec.isDelimiter || eo >= ec.length) && sc.nodeType == 3) // end and right, next sibling must be a custom element with a delimiter or a text node as nextSibling
					if(ec.isInTransition = (ev.type == 'keydown'))
					{
						if(ec.nextSibling && ec.nextSibling.is)
						{
							utils.setCaretAt(ec.nextSibling.nextSibling, (ec.nextSibling.nextSibling.isDelimiter ? 1 : 0));
							ev.preventDefault();
						}
						else
							utils.setCaretAt(ec, ec.textContent.length);
					}
			}
		},
		
		dragAndDrop : function(ev) {
			var altTarget = utils.getTopCustomElementAncestor(ev.target, this.$.editor); // || (ev.target.proxyTarget && ev.target);
			if(ev.type == 'mousedown' && altTarget && this.__actionData.type != 'drag' &&
				!(utils.isInLightDom(ev.target) && (ev.target.nodeType == 3 || (ev.target.firstChild && ev.target.firstChild.nodeType == 3))))
			{
				this.moveTarget.call(this, altTarget);
				ev.preventDefault();
				return;
			}

			if(ev.type == 'drop' && ev.target && utils.getTopCustomElementAncestor(ev.target, this.$.editor)) // prevent default drop (like text) into custom elements
				ev.preventDefault();
		}
	}
})();
