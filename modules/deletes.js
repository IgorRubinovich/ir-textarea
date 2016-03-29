// delete keys handler and non-collapsed range deleter

if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.deletes = (function() {
		var deletes = {},
			utils = window.ir.textarea.utils;
		
		deletes.handler = function(ev) {
			var keyCode = ev.keyCode || ev.which, r, sc, ec, so, eo, toDelete = null;

			if(keyCode != 46 && keyCode != 8)
				return;

			if(this.preventNextDefault)
			{
				this.preventNextDefault = false;
				ev.preventDefault();
				return;
			}
			
			if(ev.type != 'keydown')
				return;
			
			r = utils.getSelectionRange();
			if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
			if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;

			// deletes
			if(!this.$.editor.childNodes.length || utils.isEmptyParagraph(this.$.editor.firstChild)) // ignore when $.editor is empty or has one paragraph
				return;

			if(ev.type == 'keydown')
			{
				this.selectionSave();
				this.customUndo.pushUndo();
			}

			/*if(/firefox|iceweasel/i.test(navigator.userAgent) && ev.type != 'keydown')
			if(ev.type == 'keydown')
			{
				if(this.preventNextDefault)
					ev.preventDefault();
				
				this.preventNextDefault = false;
			}*/

			if(this.__actionData.target) // selected item is a priority
			{
				toDelete = this.__actionData.deleteTarget;
				forcedelete = true;
			}
			else
			if(!r.collapsed && ev.type == 'keydown') // delete a non-collapsed range
			{
				ev.preventDefault();
				this.preventNextDefault = false;
				deletes.deleteOnNonCollapsedRange.call(this, ev);
			}
			else
			{
				t = this.$.editor;

				if(sc == this.$.editor)
				{
					r = setCaretAt(sc.childNodes[so], 0);
					if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
					if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
				}

				if(!sc)
					return;

				if(ev.type == 'keydown' && keyCode == 8 && !sc.isDelimiter && (sc.previousSibling && sc.previousSibling.is && sc.textContent.length == 1 && so == 1)) // prevent jump when deleting last char in a to-be delimiter
				{
					sc.textContent = ' '
					utils.setCaretAt(sc, 1);
					ev.preventDefault();
				}
				else
				if(ev.defaultPrevented && (tcea = utils.getTopCustomElementAncestor(sc, this.$.editor)) && tcea != el)
					;
				else
				if(keyCode == 46) // del key
				{
					if(utils.getTopCustomElementAncestor(ec, this.$.editor) && ec.nodeType == 3 && !ec.nextSibling && eo >= ec.textContent.length)
						return ev.preventDefault();
					else
					if(sc.nodeType == 3 && sc.textContent.length == 1 && so == 0 && sc.nextSibling && sc.nextSibling.is)
					{
						sc.textContent = utils.DELIMITER;
						utils.setCaretAt(sc, 1);
						ev.preventDefault();
					}
					else
					if(sc.nextSibling && sc.nodeType == 3 && sc.nextSibling.is && (sc.isDelimiter || so >= sc.textContent.length) && getSelection().isCollapsed)
						forcedelete = toDelete = sc.nextSibling;
					else
					//if(/firefox|iceweasel/i.test(navigator.userAgent) && this.get("startContainer.parentNode.nextSibling", r) == el)
					if(/firefox|iceweasel/i.test(navigator.userAgent) && sc != this.$.editor && so == 0 && sc.nodeType == 3 && !sc.textContent.length && !sc.nextSibling)
					{
						if(sc.parentNode && sc.parentNode.nextSibling)
						{
							utils.setCaretAt(sc.parentNode.nextSibling, 0);
							sc.parentNode.removeChild(sc);
						}
					}
					else
					// merge nodes "manually" // /firefox|iceweasel/i.test(navigator.userAgent) && 
					if(!ec.nextSibling && ((!utils.canHaveChildren(ec.nodeType) && eo >= ec.textContent.length) || ec.isDelimiter) && this.get("parentNode.nextSibling.firstChild", ec))
					{
						if(ec.parentNode.nextSibling.firstChild.tagName == 'BR')
							ec.parentNode.nextSibling.removeChild(ec.parentNode.nextSibling.firstChild);

						utils.mergeNodes(ec.parentNode, ec.parentNode.nextSibling, true);

						if(ec.nextSibling && !utils.isInlineElement(ec))
							utils.mergeNodes(ec, ec.nextSibling, true);

						ev.preventDefault();
					}
				}
				else
				if(keyCode == 8) // backspace key
				{
					if(utils.getTopCustomElementAncestor(sc, this.$.editor) && sc.nodeType == 3 && !sc.previousSibling && so == 0)
						return ev.preventDefault();
					else
					if(sc.nodeType == 3 && sc.textContent.length == 1 && so == 1 && sc.nextSibling && sc.nextSibling.is)
					{
						sc.textContent = utils.DELIMITER;
						utils.setCaretAt(sc, 1);
						ev.preventDefault();
					}
					else
					if((sc.isDelimiter || (sc.nodeType == 3 && so == 0)) && sc.previousSibling && sc.previousSibling.is)
					{
						forcedelete = toDelete = sc.previousSibling;
						ev.preventDefault();
					}
					else
					// merge nodes "manually"
					if(sc != this.$.editor && ((so == 0 && !utils.canHaveChildren(sc)) || sc.isDelimiter) && !sc.previousSibling && sc.parentNode && sc.parentNode.previousSibling)
					{
						if(this.get("parentNode.previousSibling.lastChild", sc)) // neighbouring paragraphs with text nodes
						{
							if(sc.parentNode.previousSibling.lastChild.tagName == 'BR')
								sc.parentNode.previousSibling.removeChild(sc.parentNode.previousSibling.lastChild);

							utils.mergeNodes(sc.parentNode.previousSibling, sc.parentNode, true);

							if(sc.previousSibling && !utils.isInlineElement(sc))
								utils.mergeNodes(sc.previousSibling, sc, true);

							ev.preventDefault();
						}
						else
						if(sc.parentNode.previousSibling) // inline node before current element
						{
							utils.mergeNodes(sc.parentNode, sc.parentNode.previousSibling);
							if(sc.previousSibling && sc.previousSibling.tagName == 'BR')
								sc.parentNode.removeChild(sc.previousSibling);

							sc.parentNode.normalize();
							ev.preventDefault();
						}
					}
				}
			}
			
			if(toDelete && toDelete.parentNode && toDelete.nodeType == 1 && (forcedelete || !ev.defaultPrevented))
			{
				if(toDelete.parentNode.firstChild == toDelete && toDelete.parentNode.lastChild == toDelete)
					toDelete = toDelete.parentNode;

				if(toDelete.previousSibling && toDelete.nextSibling)
					merge = { left : toDelete.previousSibling, right : toDelete.nextSibling };
				else
				if(!toDelete.nextSibling && toDelete.parentNode != this.$.editor && toDelete.parentNode.nextSibling)
					merge = { left : toDelete.parentNode, right : toDelete.parentNode.nextSibling };
				else
				if(!toDelete.previousSibling && toDelete.parentNode != this.$.editor && toDelete.parentNode.previousSibling)
					merge = { left : toDelete.parentNode.previousSibling, right : toDelete.parentNode };

				this.deleteTarget(toDelete);

				if(merge)
					utils.mergeNodes(merge.left, merge.right, true);

				ev.preventDefault();
			}
			
			this.selectionSave();
			this.selectionRestore();
			this.clearActionData();
			
			/*if(ev.defaultPrevented && !this.preventNextDefault)
				this.preventNextDefault = true; // prevent next non-keydown (mostly FF)
			else
				this.preventNextDefault = false;*/
		}

		deletes.deleteOnNonCollapsedRange = function(ev) {
			var i, s, r, r1, sc, ec, so, eo, nso, neo, sild, eild, stpce, etpce, scp, origsc, origec;
			s = window.getSelection();
			
			var utils = window.ir.textarea.utils;
			
			origsc = s.getRangeAt(0).startContainer;
			origec = s.getRangeAt(s.rangeCount - 1).endContainer;

			for(i = 0; i < s.rangeCount; i++)
			{
				r = s.getRangeAt(i);
				sc = r.startContainer;
				ec = r.endContainer;
				scp = sc.parentNode;
				
				nso = so = r.startOffset;
				neo = eo = r.endOffset;
				
				sild = sc == this.$.editor || utils.isInLightDom(sc, this.$.editor);
				eild = ec == this.$.editor || utils.isInLightDom(ec, this.$.editor);
				
				stpce = sc != this.$.editor && utils.getTopCustomElementAncestor(sc, this.$.editor);
				etpce = ec != this.$.editor && utils.getTopCustomElementAncestor(ec, this.$.editor);

				if(((!sild || !eild) && s.rangeCount == 1) || ((stpce || etpce) && ((stpce != etpce || sc.parentNode != ec.parentNode) && s.rangeCount == 1)))
				{
					this.fire('toast', "Cannot delete over an embedded element's boundary.");
					return ev.preventDefault();
				}
				
				if(stpce && stpce == etpce && (!sild || !eild || sc.parentNode != ec.parentNode))
					stpce.parentNode.removeChild(stpce);
			
				r.deleteContents();				

				if(sc.nodeType == 1)
					while(so < sc.childNodes.length && sc.childNodes[so].nodeType == 3 && !sc.childNodes[so].textContent)
						sc.removeChild(sc.childNodes[so]);

				if(sc.nodeType == 1 && !sc.childNodes.length)
				{
					if(sc != this.$.editor)
					{
						so = utils.getChildPositionInParent(sc);
						sc.parentNode.removeChild(sc);
					}
					
					while(!scp.childNodes[so])
						so--;
					if(!scp.childNodes[so])
					{
						utils.setCaretAt(scp, 0);
						r = paste.pasteHTMLWithParagraphs(newEmptyParagraph());
					}
					else
						utils.setCaretAt(scp, so);
				}
			}
			
			//r = getSelectionRange();
			
			sc = origsc;
			while(sc && sc != this.$.editor && !utils.isParagraph(sc) && !utils.isInlineElement(sc.tagName) && !utils.canHaveChildren(sc))
				sc = utils.isInLightDom(sc.parentNode, this.$.editor) ? sc.parentNode : Polymer.dom(sc).parentNode;
			ec = origec;
			while(ec && ec != this.$.editor && !utils.isParagraph(ec) && !utils.isInlineElement(ec.tagName) && !utils.canHaveChildren(ec))
				ec = utils.isInLightDom(ec.parentNode, this.$.editor) ? ec.parentNode : Polymer.dom(ec).parentNode;
			
			if(sc.nextSibling == ec)
				utils.mergeNodes(sc, ec, true);
				//this.userInputHandler({ type : 'keydown', which : 8});

			ev.preventDefault();
		}
		
		return deletes;
	})();

