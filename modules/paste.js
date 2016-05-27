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

		pasteHtmlAtPosWithParagraphs : function(html, pos, opts) {
			var div = document.createElement('div'),
				hasContainers, hasContentBefore, hasContentAfter, 
				posCont, startCont, endCont, left, right,
				hangingStart, hangingEnd, main, finalPos;
			
			if(!html)
				return;

			if(typeof html == 'string')
				div.innerHTML = html;
			else
			if(html instanceof Node)
				div = html;
			else
				throw new Error('Bad html parameter to pasteHtmlAtPosWithParagraphs: must be a string or a node.')
			

			// paste what:
			// 
			// div
			//		1. hanging start
			// 		2. nonCustomContainer
			//			stuff
			//		3. ... more containers ...
			//		4. hanging end
			//
			// paste where:
			//
			//		a. hanging start 		
			//		b. nonCustomContainer
			// 		c. 		(contentBeforePos) (pos) (contentAfterPos)
			// 		d. hanging end
			// 
			
			
			posCont = utils.getNonCustomContainer(pos.container, opts.top);
			
			hasContentBefore = utils.posToContainerEdgeHasContent(pos, "backward", top);
			hasContentAfter = utils.posToContainerEdgeHasContent(pos, "forward", top);
			
			// if div has no containers paste as is
			if(!utils.hasContainers(div) || !posCont)
				return paste.pasteHtmlAtPos(html, pos);
			
			// if posCont is top, split as high as possible under top and paste as is
			if(opts.top == posCont)
			{
				right = extract.splitNode(pos.container, pos.offset, utils.getLastAncestorBeforeTop(pos.container, opts.top), opts.top)
				return paste.pasteHtmlAtPos(html, { container : right, offset : 0 });
			}
			// *** we are pasting into nonCustomContainer ***
			
			// paste hanging start before splitting
			hangingStart = document.createDocumentFragment();
			while((t = Polymer.dom(div).firstChild) && !utils.isNonCustomContainer(t))
				hangingStart.appendChild(t);
			
			if(hangingStart.childNodes.length)
				pos = paste.pasteHtmlAtPos(hangingStart, pos);
			
			// split target
			right = extract.splitNode(pos.container, pos.offset, posCont, opts.top)
			left = hasContentBefore && Polymer.dom(right).previousSibling;
			
			// paste hanging end before splitting
			hangingEnd = document.createDocumentFragment();
			while((t = Polymer.dom(div).lastChild) && !utils.isNonCustomContainer(t))
				hangingEnd.appendChild(t);

			if(hangingEnd.childNodes.length)
				finalPos = pos = paste.pasteHtmlAtPos(hangingEnd, { container : right.firstChild, offset : 0 });

			main =  document.createDocumentFragment();
			while((t = Polymer.dom(div).firstChild))
				main.appendChild(t);
			
			// paste the rest before last
			pos = paste.pasteHtmlAtPos(main, right ? 
												{ container : right, offset : 0 } : 
												{ container : utils.parentNode(left), offset : utils.getChildPositionInParent(left) + 1 })

			if(!finalPos)
				finalPos = pos;
			
			return finalPos;
		},
		
		pasteHtmlWithParagraphs : function (html, opts) // html is either a string or an element that will be inserted as is
		{
			var div, paragraph, r, sp, caretAt = {}, firstIsEmptyParagraph,
				container, newWrapperParagraph, container, firstToWrap, index,
				isNewParagraph, lastInserted, pos, first, last, takeout, tp,
				sc, ec, so, eo, emptyp,
				editor = opts.editor;

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

			// this.customUndo.pushUndo(false, true);
			
			// if not, fall back to regular paste
			if(!paragraph)
				return paste.pasteHtmlAtCaret.call(this, html);
			
			r = utils.getSelectionRange();

			if(!r)
				return;

			// otherwise html contains paragraphs.
			if(!r.collapsed)
			{
				if(r.startContainer.nodeType == 3 && r.startOffset > 0)
					pos = { container : r.startContainer, offset : r.startOffset };
				else
					pos = { container : Polymer.dom(r.startContainer).parentNode, offset : utils.getChildPositionInParent(r.startContainer) };

				r.deleteContents();

				if(!Polymer.dom(editor).childNodes.length)
				{
					Polymer.dom(editor).appendChild(emptyp = utils.newEmptyParagraph());
					Polymer.dom.flush();
					utils.setCaretAt(emptyp, 0);
				}
				else
					utils.setCaretAt(emptyp = pos.container, pos.offset);
			}
			
			if(!editor.childNodes.length)
			{
				Polymer.dom(editor).appendChild(emptyp = utils.newEmptyParagraph());
				Polymer.dom.flush();
				r = utils.setCaretAt(emptyp, 0);
			}
			// sometimes startOffset == number of child nodes
			if(r.startContainer == editor && r.startContainer.nodeType == 1 && r.startOffset == r.startContainer.childNodes.length)
			{
				Polymer.dom(r.startContainer).appendChild(emptyp = document.createTextNode(''));
				Polymer.dom.flush();
				r = utils.setCaretAt(Polymer.dom(r.startContainer).childNodes[r.startOffset], 0);
			}

			// remove 'br' if is direct child of $.editor
			if(r.startContainer == editor && r.startContainer.nodeType == 1 && 
								Polymer.dom(r.startContainer).childNodes[r.startOffset].nodeType == 1 && 
								r.startContainer.childNodes[r.startOffset].tagName == 'BR')
			{
				Polymer.dom(r.startContainer).insertBefore(utils.newEmptyParagraph(), Polymer.dom(r.startContainer).childNodes[r.startOffset]);
				r = utils.setCaretAt(Polymer.dom(r.startContainer).childNodes[r.startOffset], 0);
				Polymer.dom(Polymer.dom(r.startContainer).parentNode).removeChild(Polymer.dom(r.startContainer).nextSibling);
			}
			// add empty paragraph if doesn't exist
			if(Polymer.dom(editor).childNodes.length == 0)
			{
				Polymer.dom(editor).appendChild(utils.newEmptyParagraph());
				Polymer.dom.flush();
				r = utils.setCaretAt();
			}
			
			sc = r.startContainer, so = r.startOffset;
			ec = r.endContainer, eo = r.endOffset;

			// move selection range off $.editor on both ends or FF will act funny
			if(r.startContainer == editor || r.endContainer == editor)
			{
				if(sc == editor) sc = Polymer.dom(r.startContainer).childNodes[r.startOffset], so = 0;
				if(ec == editor) ec = Polymer.dom(r.endContainer).childNodes[r.endOffset], eo = 0;

				r = utils.setCaretAt(sc, so, ec, eo);

				//if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
				//if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
			}

			// analyze where the caret is in paragraph

			first = r.startContainer;
			firstOffset = r.startOffset;
			if(Polymer.dom(first).firstChild && (!utils.selfOrLeftmostDescendantIsSpecial(first.childNodes[firstOffset])))
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
			if(!utils.isParagraph(first) && (first.nodeType == 3 || utils.isInlineElement(first.tagName)) && first.parentNode == editor)
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
				if(first.parentNode != editor)
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

		pasteHtmlAtPos : function(html, pos, top) {
			var c = pos.container, 
				o = pos.offset, 
				parent, first, last, lastPos,
				d = document.createElement('div'), index, len, t,
				state = { html : {}, pos : {} }; // see states below
			
			if(typeof html == 'string')
				d.innerHTML = html;
			else
			if(html instanceof DocumentFragment)
				d = html;
			else
				d.appendChild(html);
			
			parent = utils.parentNode(pos.container, top);

			/*
			/ states and steps
			
												pos
			html								---
			----								|a. text start	|b. text middle		|c. text end	|d. non-text	|e. last child text	|f. last child block
												|   |---O		|   --|--O			|   ----|O		|	|O 			|   ---|.			|   ---O|.
			____________________________________|_______________|___________________|_______________|_______________|___________________|___________________
			1. start: text  end: text	--O-- 	|paste,merge	|split,paste,merge	|paste, merge	|paste			|append, merge		|append
			2. start: text  end: block	--O   	|paste			|split,paste,merge	|paste, merge	|paste			|append, merge		|append
			3. start: block end: text	  O-- 	|paste,merge	|split,paste,merge	|paste			|paste			|append				|append
			4. start: block end: block	  O   	|paste			|split,paste		|paste			|paste			|append				|append
												|				|                   |               |               |                   |
			Pictograms:
			-- text node
			O  block node
			|  caret
			. end of parent container
			
			
			/ steps order
			is always same but steps are applied selectively
			
			1-4.b.			split
			
			1-4.a-d			paste
			- or -
			1-4.e-f			append
			
			1.a-c,e
			2.b,c,e			merge (normalize)
			3.a,b
			
			/ resulting position
			
				a					b						c						d						e					f
			1	last, len(last)		last, len(last)			last, len(last)			last, len(last)			last,len(last)		last, len(last)
			2	pos.cont,0			pos.cont, 0				pos.cont, 0				pos.cont,0				parent,len(parent)	pos.cont,len(pos.cont)	
			3	last, len(last)		last, len(last)			last, len(last)			last, len(last)			last,len(last)		last,len(last)															
			4	pos.cont,0			pos.cont,0				pos.cont,0				pos.cont,0				parent,len(parent)	parent,len(parent)
			
			- *.e-f (last position must remain last)
			- 1.a-c, 2b-c, 3a,c (changes due to text merges)
			
			*/
			
			// first determine the state according to the table
			
			// identify html states 1-4
			state.html = 				1 && d.firstChild.nodeType == 3 && d.lastChild.nodeType == 3 && 1;
			state.html = state.html || 	2 && d.firstChild.nodeType == 3 && d.lastChild.nodeType == 1 && 2;
			state.html = state.html || 	3 && d.firstChild.nodeType == 1 && d.lastChild.nodeType == 3 && 3;
			state.html = state.html || 	4;

			// identify pos states e-f
			state.pos.lastChildText = 	pos.container.nodeType == 3 && 
										parent.lastChild == pos.container && 
										pos.offset == pos.container.textContent.length &&
										(state.pos.code = 'e');
			
			state.pos.lastChildBlock = 	pos.container.nodeType == 1 && 
										utils.canHaveChildren(pos.container) &&
										pos.container.childNodes.length == pos.offset &&
										(state.pos.code = 'f');
										
			state.pos.lastChild = state.pos.code;
			
			// identify pos states a-c
			if(!state.pos.lastChild)
			{
				state.pos.textStart = utils.atText(pos, 'start') 	&& (state.pos.code = 'a');
				state.pos.textMiddle = utils.atText(pos, 'middle') 	&& (state.pos.code = 'b');
				state.pos.textEnd = utils.atText(pos, 'end') 		&& (state.pos.code = 'c');
			}
			
			if(!state.pos.code)
				state.pos.code = "d";

			// steps

			// prepare
			
			// only move caret forward when at text end and it's not last child
			if(state.pos.textEnd && pos.container.nextSibling)
			{
				pos.container = pos.container.nextSibling
				pos.offset = 0;
				state.pos.lastChild = true;
				state.pos.code = "d";
			}
			
			// split
			// pos.container remains same because we insert the next text node before container
			if(state.pos.textMiddle)
			{
				Polymer.dom(parent).insertBefore(tn = document.createTextNode(''), pos.container);
				tn.textContent = pos.container.textContent.slice(0, pos.offset);
				pos.container.textContent = pos.container.textContent.slice(pos.offset, pos.container.textContent.length);
			}
			
			first = last = d.firstChild;
			// append
			if(state.pos.lastChildText)
				while(d.firstChild)
				{
					Polymer.dom(parent).appendChild(last = d.firstChild);
				}
			else
			if(state.pos.lastChildBlock)
				while(d.firstChild)
					Polymer.dom(pos.container).appendChild(last = d.firstChild);
			// or insert
			else
				while(d.firstChild)
					Polymer.dom(parent).insertBefore(last = d.firstChild, pos.container);

			Polymer.dom.flush();
				
			len = 0;
			if(first && first.nodeType == 3 && Polymer.dom(first).previousSibling && Polymer.dom(first).previousSibling.nodeType == 3)
			{
				len = Polymer.dom(first).previousSibling.textContent.length;
				utils.mergeNodes(t = Polymer.dom(first).previousSibling, first);
				if(first == last)
					last = t;
			}			
			if(last && last.nodeType == 3 && Polymer.dom(last).nextSibling && Polymer.dom(last).nextSibling.nodeType == 3)
			{
				len = last.textContent.length;
				last = utils.mergeNodes(last, Polymer.dom(last).nextSibling).container;
			}

			Polymer.dom.flush();

			// infere new position
			if(state.html == 1 || state.html == 3)
			{
				index = utils.getChildPositionInParent(last);
				//len = last.textContent.length;
				
				parent.normalize();
				
				lastPos = { container : last, offset : len }
			}
			else
			{	
				if(state.pos.code < "e")
					lastPos = { container : pos.container, offset : 0 }
				else
				if(state.pos.code == "e")
					lastPos = { container : parent, offset : parent.childNodes.length }
				else
					lastPos = { container : pos.container, offset : pos.container.childNodes.length }
			}
			
			return lastPos;
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

					sc.parentNode.normalize();
					
					// Preserve the selection
					if (lastNode) {
						if(lastNode.nextSibling && lastNode.nextSibling.tagName == 'BR' && !keepLastBr)
							lastNode.parentNode.removeChild(lastNode.nextSibling);

						offset = 0;

						pos = utils.getLastCaretPosition(lastNode);
						target = pos ? pos.container : lastNode;
						offset = pos ? pos.offset : 0;

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

			return range;
		}
	}
	
	return paste;
})();
