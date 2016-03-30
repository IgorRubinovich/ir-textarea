if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.paste = (function() {
	var paste, utils = window.ir.textarea.utils;
	
	paste = {
		pasteHandler : function(e) {
			var v, d, withParagraphs, i, n, nn;
			if(typeof clipboardData != 'undefined')
				v = clipboardData.getData();
			else
				v = e.originalEvent ? e.originalEvent.clipboardData.getData('text/html') : ((e.clipboardData.getData('text/html') || '<span class="paragraph">' + e.clipboardData.getData('text/plain').replace(/\n/g, '</span><span class="paragraph">') + "</span>"));

			if(!v)
				return;

			if(v.match(/<!--StartFragment-->/i))
			{
				v = v	.replace(/<!--\[if[^\[]*\[endif\]--\>/gi).replace(/\<style[\s][\S]+<\/style>/ig, '')
						.replace(/<(meta|link)[^>]>/, '')
						.match(/<!--StartFragment-->([\s\S]*?)(?=<!--EndFragment-->)/i)[1]
						.replace(/\<\/?o\:[^>]*\>/g, '')
						.replace(/<p([\s\S]*?(?=<\/p>))<\/p>/gi, '<span class="paragraph" $1</span>')
						.replace(/\n/g, '')
						.replace(/<span[^>]*>\s*<\/span>/g, ' ')
						.replace("&nbsp;", " ");
			}
			else
			if(/\r|\n/.test(v))
				v = '<span class="paragraph">' + v.replace(/\r|\n/, '</span><span class="paragraph">') + "</span>";


			d = document.createElement('div');
			d.innerHTML = v;

			i = 0;
			while(i < d.childNodes.length)
			{
				n = d.childNodes[i];

				if(((n.nodeType == 3 || (n.tagName == 'SPAN' && !n.childNodes.length)) && /^\s*(&nbsp;)*\s*$/.test(n.textContent)))
					d.removeChild(n);
				else
				{
					if(n.nodeType == 3)
					{
						nn = document.createElement('span');
						nn.innerHTML = n.textContent;
						d.insertBefore(nn, n);
						d.removeChild(n);
						n = nn;
					}

					if(n.tagName == 'SPAN')
						if(d.childNodes.length == 1 && n.childNodes.length == 1 && n.childNodes[0].nodeType == 3)
						{
							d.insertBefore(n.childNodes[0], n);
							d.removeChild(n);
						}
						else
							n.classList.add('paragraph');

					i++;
				}
			}

			utils.visitNodes(d, function(el) {
				if(el.nodeType == 1) el.removeAttribute('style') ;
			}, { noRoot : true });

			// edit out eventual closing br
			if(d.lastChild && d.lastChild != d.firstChild && d.lastChild.tagName == "BR")
				d.removeChild(d.lastChild);

			paste.pasteHtmlWithParagraphs.call(this, d.innerHTML, { removeFormat : false });

			e.preventDefault();
			return false;
		},	
	
		pasteHtmlWithParagraphs : function (html, opts) // html is either a string or an element that will be inserted as is
		{
			var div, paragraph, r, sp, caretAt = {}, firstIsEmptyParagraph,
				container, newWrapperParagraph, container, firstToWrap, index,
				isNewParagraph, lastInserted, pos, first, last, takeout, tp,
				sc, ec, so, eo;

			if(!html)
				return;

			div = document.createElement('div');
			if(typeof html == 'string')
				div.innerHTML = html;
			else
				div.appendChild(html);

			if(div.lastChild.nodeType == 1 && div.lastChild.tagName == 'BR')
				div.removeChild(div.lastChild);

			// html = div.innerHTML;

			// check if there are any paragraphs
			paragraph = div.querySelector('span.paragraph');

			r = this.selectionSave();
			r = this.selectionRestore();

			this.customUndo.pushUndo(false, true);

			// if not, fall back to regular paste
			if(!paragraph)
				return paste.pasteHtmlAtCaret.call(this, html);

			// otherwise html contains paragraphs.
			if(!r.collapsed)
			{
				if(r.startContainer.nodeType == 3 && r.startOffset > 0)
					pos = { container : r.startContainer, offset : r.startOffset };
				else
					pos = { container : r.startContainer.parentNode, offset : utils.getChildPositionInParent(r.startContainer) };

				r.deleteContents();

				if(!this.$.editor.childNodes.length)
					utils.setCaretAt(this.$.editor.appendChild(utils.newEmptyParagraph()), 0);
				else
					utils.setCaretAt(pos.container, pos.offset);
			}

			r = utils.getSelectionRange();

			if(!this.$.editor.childNodes.length)
				r = utils.setCaretAt(this.$.editor.appendChild(utils.newEmptyParagraph()), 0);
			
			// sometimes startOffset == number of child nodes
			if(r.startContainer == this.$.editor && r.startContainer.nodeType == 1 && r.startOffset == r.startContainer.childNodes.length)
			{
				r.startContainer.appendChild(document.createTextNode(''));
				r = utils.setCaretAt(r.startContainer.childNodes[r.startOffset], 0);
			}

			// remove 'br' if is direct child of $.editor
			if(r.startContainer == this.$.editor && r.startContainer.nodeType == 1 && r.startContainer.childNodes[r.startOffset].nodeType == 1 && r.startContainer.childNodes[r.startOffset].tagName == 'BR')
			{
				r.startContainer.insertBefore(utils.newEmptyParagraph(), r.startContainer.childNodes[r.startOffset]);
				r = utils.setCaretAt(r.startContainer.childNodes[r.startOffset], 0);
				r.startContainer.parentNode.removeChild(r.startContainer.nextSibling);
			}
			// add empty paragraph if doesn't exist
			if(this.$.editor.childNodes.length == 0)
			{
				this.$.editor.appendChild(utils.newEmptyParagraph());
				r = utils.setCaretAt();
			}
			
			sc = r.startContainer, so = r.startOffset;
			ec = r.endContainer, eo = r.endOffset;

			// move selection range off $.editor on both ends or FF will act funny
			if(r.startContainer == this.$.editor || r.endContainer == this.$.editor)
			{
				if(sc == this.$.editor) sc = r.startContainer.childNodes[r.startOffset], so = 0;
				if(ec == this.$.editor) ec = r.endContainer.childNodes[r.endOffset], eo = 0;

				r = utils.setCaretAt(sc, so, ec, eo);

				//if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
				//if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
			}

			// analyze where the caret is in paragraph

			first = r.startContainer;
			firstOffset = r.startOffset;
			if(first.firstChild && (!utils.selfOrLeftmostDescendantIsSpecial(first.childNodes[firstOffset])))
			{
				first = first.childNodes[firstOffset];
				firstOffset = 0;
			}

			firstIsEmptyParagraph = utils.canHaveChildren(first) ? utils.isEmptyParagraph(first) : (first.parentNode && utils.isEmptyParagraph(first.parentNode));
			isNewParagraph = div.childNodes.length == 1 && utils.isEmptyParagraph(div.firstChild);

			if(firstIsEmptyParagraph)
				caretAt.containerStart = true;
			else
			// if it's a bare text/inline node (sitting on $.editor) wrap it and its text/inline siblings in a paragraph
			if(!utils.isParagraph(first) && (first.nodeType == 3 || utils.isInlineElement(first.tagName)) && first.parentNode == this.$.editor)
			{
				newWrapperParagraph = document.createElement('span');
				newWrapperParagraph.classList.add('paragraph');
				firstToWrap = first;

				// go back until paragraph/block element/container start
				while(!utils.isParagraph(firstToWrap.previousSibling) && (firstToWrap.previousSibling && (firstToWrap.previousSibling.is || firstToWrap.previousSibling.nodeType == 3 || utils.isInlineElement(firstToWrap.previousSibling.tagName))))
					firstToWrap = firstToWrap.previousSibling;

				container = firstToWrap.parentNode;
				index = utils.getChildPositionInParent(firstToWrap);

				// go forward and wrap anything until next paragraph/block element
				while(!utils.isParagraph(firstToWrap) && (firstToWrap && (firstToWrap.is || firstToWrap.nodeType == 3 || utils.isInlineElement(firstToWrap.tagName))))
				{
					newWrapperParagraph.appendChild(firstToWrap)
					firstToWrap = container.childNodes[index];
				}
				firstIsEmptyParagraph = utils.isEmptyParagraph(newWrapperParagraph);

				// add the wrapping paragraph
				if(index < container.childNodes.length)
					container.insertBefore(newWrapperParagraph, container.childNodes[index]);
				else
					container.appendChild(newWrapperParagraph);

				if(first.nodeType == 1)
					firstOffset = utils.getChildPositionInParent(first);
			}

			// wrap bare nodes
			container = first;
			// find first praragraph or non-text, non-inline container. it could have been the editor but we wrapped bare nodes earlier
			while(!utils.isContainer(container))
				container = container.parentNode;

			if(caretAt.containerStart || (container.firstChild == first && firstOffset == 0))
				caretAt.containerStart = true;
			else
			{
				pos = utils.getLastCaretPosition(container);
				if(pos.container == first && pos.offset == firstOffset && (!first.nextSibling || (first.nextSibling == first.parentNode.lastChild && first.nextSibling.tagName == 'BR'))) // last condition prevents ignoring elements that can't have children implied by utils.getLastCaretPosition
					caretAt.containerEnd = true;
				else
					caretAt.containerMiddle = true;
			}

			// paste html and move carret
			if(caretAt.containerStart)
			{
				while(div.firstChild)
					lastInserted = container.parentNode.insertBefore(div.firstChild, container);

				if(!isNewParagraph)
				{
					pos = utils.getLastCaretPosition(lastInserted);
					utils.setCaretAt(pos.container, pos.offset);
					//if(!container.textContent)
					//	container.parentNode.removeChild(container);
				}
				else
					utils.setCaretAt(sc, so, ec, eo);
				return;
			}
			else
			if(caretAt.containerEnd)
			{
				if(last = container.nextSibling)
					while(div.firstChild)
						lastInserted = container.parentNode.insertBefore(div.firstChild, last);
				else
					while(div.firstChild)
						lastInserted = container.parentNode.appendChild(div.firstChild);

				pos = utils.getLastCaretPosition(lastInserted);
				utils.setCaretAt(pos.container, pos.offset);
			}
			else // containerMiddle
			{
				if(first.tagName == 'BR') // remember we are in the middle of a paragprah so prevSibling exists
				{
					first = first.previousSibling;
					first.parentNode.removeChild(first.nextSibling);
					if(utils.canHaveChildren(first))
					{
						pos = utils.getLastCaretPosition(first);
						first = pos.container;
						firstOffset = pos.offset;
					}
					else
					{
						firstOffset = utils.getChildPositionInParent(first);
						first = first.parentNode;
					}
				}

				if(!utils.selfOrLeftmostDescendantIsSpecial(first)) // first is custom element
					last = utils.splitNode(first, firstOffset, container);
				else
				if(first.parentNode != this.$.editor)
					last = utils.splitNode(first.parentNode, utils.getChildPositionInParent(first), container);
				else
					last = first;

				first = last.previousSibling;

				if(last.nodeType == 1 && last.firstChild) {
					if(last.firstChild.nodeType == 3 && !last.firstChild.textContent)
						last.removeChild(last.firstChild);
					if(last.firstChild && last.firstChild.tagName == "BR")
						last.removeChild(last.firstChild);
					if(!last.childNodes.length)
						last.parentNode.removeChild(last);
				}

				last = first.nextSibling;

				if(!isNewParagraph || (sp = utils.selfOrLeftmostDescendantIsSpecial(last)) || !last)
				{
					if(sp && !utils.selfOrLeftmostDescendantIsSpecial(first))
						lastInserted = first;
					else
						while(div.firstChild)
							lastInserted = first.parentNode[last ? 'insertBefore' : 'appendChild'](div.firstChild, last);

					pos = utils.getLastCaretPosition(lastInserted);
					return utils.setCaretAt(pos.container, pos.offset);
				}
				return utils.setCaretAt(last, 0);
			}
		},

		pasteHtmlAtCaret : function(html, removeFormat, keepLastBr) {
			var sel, range, endNode, newRange, node, lastNode, preLastNode, el, frag, pos, isLastInEditor, target, pos, offset, sc, so, ec, eo, r, is;

			if (window.getSelection) {
				// IE9 and non-IE
				sel = window.getSelection();
				if (sel.getRangeAt && sel.rangeCount) {
					r = sel.getRangeAt(0);

					sc = r.startContainer;
					so = r.startOffset;
					ec = r.startContainer;
					eo = r.startOffset;


					if(r.startContainer.isDelimiter)
					{
						sc.textContent = "";
						sc.isDelimiter = false;
						so = 0;
						if(sc == ec)
							eo = 0;
					}
					if(r.endContainer.isDelimiter)
					{
						ec.textContent = "";
						ec.isDelimiter = false;
						eo = 0;
					}
					r = utils.setCaretAt(sc, so, ec, eo);

					r.deleteContents();

					// Range.createContextualFragment() would be useful here but is
					// only relatively recently standardized and is not supported in
					// some browsers (IE9, for one)
					el = document.createElement("div");
					el.innerHTML = html;
					frag = document.createDocumentFragment();

					while ( (node = el.firstChild) ) {
						preLastNode = lastNode;
						lastNode = frag.appendChild(node);
						if(removeFormat)
							this.removeFormat(lastNode);
					}
					var firstNode = frag.firstChild;

					if(r.startContainer.nodeType == 1 &&
						(r.startOffset >= r.startContainer.childNodes.length) &&
						r.startContainer.childNodes[r.startOffset-1] &&
						r.startContainer.childNodes[r.startOffset-1].tagName == 'BR')

						r = utils.setCaretAt(r.startContainer, r.startOffset-1)

					r.insertNode(frag);

					// Preserve the selection
					if (lastNode) {
						if(lastNode.nextSibling && lastNode.nextSibling.textContent == '' && !keepLastBr)
							lastNode.parentNode.removeChild(lastNode.nextSibling);
						if(lastNode.nextSibling && lastNode.nextSibling.tagName == 'BR' && !keepLastBr)
							lastNode.parentNode.removeChild(lastNode.nextSibling);

						if(lastNode.is && !lastNode.nextSibling)
							lastNode.parentNode.appendChild(document.createTextNode(utils.DELIMITER))
						
						t = lastNode;
						while(t.parentNode && t.parentNode != this.$.editor)
						{
							is = t.is
							t = t.parentNode;
						}

						offset = 0;
						//if(!is && t.parentNode == this.$.editor && !t.nextSibling)
						//	t.parentNode.appendChild(target = newEmptyParagraph());
						//else
						//{
						pos = utils.getLastCaretPosition(lastNode);
						if(!pos)
							target = utils.nextNode(lastNode, true);
						else
						{
							target = pos.container;
							offset = pos.offset;
						}
						//}

						return utils.setCaretAt(target, offset);
					}
				}
			} else if ( (sel = document.selection) && sel.type != "Control") {
				// IE < 9
				document.selection.createRange().pasteHTML(html);
				/*
				var originalRange = sel.createRange();
				originalRange.collapse(true);
				sel.createRange().pasteHTML(html);
				if (selectPastedContent) {
					range = sel.createRange();
					range.setEndPoint("StartToStart", originalRange);
					range.select();
				}
				*/
			}

			this._updateValue();

			return range;
		}
	}
	
	return paste;
})();
