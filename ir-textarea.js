(function () {
  var INLINE_ELEMENTS = {};
  "font,b,big,i,small,tt,abbr,acronym,cite,code,dfn,em,kbd,strong,samp,time,var,a,bdo,br,img,map,object,q,script,span,sub,sup".split(/,/)
    .forEach(function(tag) { INLINE_ELEMENTS[tag.toUpperCase()] = true });

  console.log('ir-textarea');
  Polymer({
		is : 'ir-textarea',
		ready : function() {
		  var that = this,commands = this.commands.split(/,/);

			this.changed = true;

			this.__actionData = {};

			"mousedown,mouseup,keydown,keyup,keypress,drop".split(',')
				.forEach(function(evType)
				{
					that.$.editor.addEventListener(evType, this.userInputHandler.bind(this));
				}.bind(this));

			/*this.$.editor.addEventListener('click', function(ev) { 
				if(ev.target.is != 'paper-dialog')
					console.log('hi setup');
			}, true); // capturing phase*/
			
			this.$.resizeHandler.addEventListener('mousedown', function(ev) { ev.preventDefault(); }); // capturing phase
			this.$.resizeHandler.addEventListener('mousemove', function(ev) { ev.preventDefault(); }); // capturing phase
			
			this.$.editor.addEventListener('click', this.contextMenuShow.bind(this), true); // capturing phase
			this.$.editor.addEventListener('paste', this.pasteHandler.bind(this));
			// that.$.editor.addEventListener('copy', pasteHandler);

			var defs = {};
			window.ir.textarea.commands
				.forEach(function(cmdDef) {
					if(commands.indexOf(cmdDef.cmd) > -1)
						defs[cmdDef.cmd] = cmdDef;
				});

			// get buttons in order
			this.toolbarButtons = commands.map(function(c) { return c ? defs[c] : ""; });

			this.$.htmlTextArea.addEventListener("change", function () {
				if(that.$.htmlTextArea.value == that.value)
					return;

				that.$.editor.innerHTML = that.value = that.$.htmlTextArea.value;
			});

			this.$.mediaEditor.editor = this.$.editor;

			this.set('customUndo', CustomUndoEngine(this.$.editor, {
																		preserve : this.customElements,
																		getValue : this.getCleanValue.bind(this),
																		contentFrame : '[content]', // '[content]<span class="paragraph"><br></span>',
																		timeout : false,
																		onRestoreState : function(el) {
																			this.selectionSave()
																			this.ensureCursorLocationIsValid();
																			this.fire('scroll-into-view', el);
																		}.bind(this)
																	}))
		},

		attached: function(){
			this.insertPlugins();

			var cleanval;

			this.configureToolbar()

			Object.keys(this.promptProcessors).forEach(function(pp) {
				var el = document.getElementById(this.promptProcessors[pp]);
				if(!el._hasOverlayClosedListener)
					el.addEventListener('iron-overlay-closed', function() { this.selectionRestore(); }.bind(this));

				el._hasOverlayClosedListener = true;
			}.bind(this));

			//that.domProxyManager.createProxies()

			if(/^\s*$/.test(this.$.editor.innerHTML))
			{
				this.$.editor.innerHTML = "";
				this.$.editor.appendChild(newEmptyParagraph());
			}

			// set up and start the observer
			this.observerCycle = 0;
			this.customElements = [];
			this.editorMutationObserver = new MutationObserver(this.editorMutationHandler.bind(this));
			this.editorMutationObserverConfig = {
				attributes : true,
				childList : true,
				subtree : true,
				characterData : true,
				characterDataOldValue : true
			}

			this.connectEditorObserver();

			this._initialValue = this.$.editor.innerHTML = this.getCleanValue();

			//this._updateValue();
		},

		connectEditorObserver : function()
		{
			this.editorMutationObserver.observe(this.$.editor, this.editorMutationObserverConfig);
		},

		disconnectEditorObserver : function()
		{

			this.editorMutationObserver.disconnect();
		},

		configureToolbar : function() {
			var tbar = {}, that = this;
			tbar.toolbarOffsetTop = this.offsetTop;
			tbar.toolbarOffsetHeight = this.offsetHeight;
			tbar.toolbarOffsetWidth = this.offsetWidth;

			tbar.setPosition = function(x){

				if(tbar.scrollTop > tbar.toolbarOffsetTop && (that.$.borderWrapper.clientHeight + tbar.toolbarOffsetTop ) > tbar.scrollTop){
					if(tbar.headerState == 0)
						that.set("toolbarstyle",'top:'+tbar.headerHeight+'px');
					else
					if(tbar.headerState == 2)
						that.set("toolbarstyle",'top:'+tbar.condensedHeaderHeight+'px');
					else if(tbar.headerState == 3)
						that.set("toolbarstyle",'top:'+ (tbar.headerHeight) +'px');

					if(window.innerWidth > 900)
						that.set("toolbarfix",'fixit');
				}
				else
				if(window.innerWidth > 900){
						that.set("toolbarfix",'nofix');
						that.set("toolbarstyle",'top:56px');
				}
			};

			mediator.subscribe('scrolling', function( arg ){
				tbar.scrollTop = arg.scrollTop;
				tbar.headerState = arg.headerState;
				tbar.condensedHeaderHeight = arg.condensedHeaderHeight;
				tbar.headerHeight = arg.headerHeight;
				tbar.transformOffset = arg.transformOffset;;
				tbar.setPosition();
			});

			mediator.subscribe('showToolbar', function( arg ){
				if(arg){
					that.show();
				}
				else{
					that.hide();
				}

			})
		},

		userInputHandler : function (ev) {
			var altTarget, noMoreSave, el, toDelete, keyCode = ev.keyCode || ev.which, t, 
				forcedelete, r, done, localRoot, last, n, nn, pn, pos, firstRange, merge, sc, ec, so, eo, toMerge;

			if((ev.keyCode == 90 || ev.keyCode == 89) && ev.ctrlKey) // undo/redo are handled in their own handler
				return;

			this.selectionSave();
			this.selectionRestore(true);

			// save position on control keys
			if(((ev.type == 'keyup') && ([33,34,35,36,37,38,39,40].indexOf(keyCode) > -1)) || (ev.type == 'mouseup'))
				this.customUndo.pushUndo();
			else
			if(ev.keyCode && !ev.ctrlKey && !ev.metaKey && !ev.altKey)
				this.clearActionData();

			if (ev.type == 'keyup' && keyCode == 13) { 	// line break/paragraph
				return ev.preventDefault();
			}
			
			if (ev.type == 'keydown' && keyCode == 13) { 	// line break/paragraph
				r = this.selectionRestore();
				if(ev.shiftKey || // line break
					getTopCustomElementAncestor(r.startContainer, this.$.editor) ||
					this.selectAncestor(r.startContainer, 'table', this.$.editor) ||  // need more work to enable paragraphs in tables
					getTopCustomElementAncestor(r.endContainer, this.$.editor))
				{
						r = getSelectionRange();
						
						if(r.startContainer.nodeType == 3 && (r.startContainer.length - 1 <= r.startOffset && r.startContainer.textContent.charAt(r.startOffset).match(/^ ?$/) && ((nextNode(r.startContainer) || {}).tagName != "BR")))
							firstRange = this.pasteHtmlAtCaret('<br>', false, true);

						this.pasteHtmlAtCaret('<br>', false, true);

						r = getSelectionRange();
						pos = r.startOffset;

						if(firstRange && isSpecialElement(nextNode(r.startContainer)))
							setCaretAt(firstRange.startContainer, 0);
						else
						if(!r.startContainer.childNodes.length)
						{
						  n = r.startContainer.parentNode;
						  pos = getChildPositionInParent(n);
						}
						else
						{
						  while(pos >= r.startContainer.childNodes.length) pos--;
						  n = r.startContainer;
						}
				}
				else	// new paragraph
					this.pasteHtmlWithParagraphs('<span class="paragraph"><br></span>', true);

				//this.ensureCursorLocationIsValid({reverseDirection : true});

				this.frameContent();

				this.selectionSave();
				ev.preventDefault();
			}

			if(ev.type == 'keydown' || ev.type == 'keyup')
			{
				r = getSelectionRange();
				if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
				if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;

				if([35,36,37,39].indexOf(keyCode) > -1) // left/right/home/end
				{
					if(sc && (keyCode == 36 || keyCode == 37) && sc.isDelimiter) // home and left
						(sc.isInTransition = (ev.type == 'keydown'))
							? setCaretAt(Polymer.dom(sc).parentNode, getChildPositionInParent(sc, true)) : setCaretAt(sc, 1);
					else
					if(ec && (keyCode == 35 || keyCode == 39) && ec.isDelimiter && ec.nextSibling) // end and right, next sibling must be a custom element with a delimiter or a text node as nextSibling
						if(ec.isInTransition = (ev.type == 'keydown'))
							setCaretAt(ec.nextSibling.nextSibling, 0);
							//? setCaretAt(Polymer.dom(ec).parentNode, getChildPositionInParent(ec.nextSibling.nextSibling, true)) : setCaretAt(ec, 1);
				}

				if(keyCode == 8 || keyCode == 46) // deletes
				{
					if(ev.type != 'keydown')
						return ev.preventDefault()
						
					t = this.$.editor;
					
					if(sc == this.$.editor)
					{
						r = setCaretAt(sc.childNodes[so], 0);
						if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
						if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
					}

					if(!sc)
						return;
					
					if(ev.type == 'keydown' && keyCode == 8 && (sc.previousSibling && sc.previousSibling.is && sc.textContent.length == 1 && so == 1)) // prevent jump when deleting last char in a to-be delimiter
					{
						sc.textContent = ' '
						setCaretAt(sc, 1);
						ev.preventDefault();
					}
					else
					if(ev.defaultPrevented && (tcea = getTopCustomElementAncestor(sc, this.$.editor)) && tcea != el)
						;
					else
					if(this.__actionData.target)
					{
						toDelete = this.__actionData.target;
						forcedelete = true;
					}
					else
					if(keyCode == 46) // del key
					{
						if(!isInLightDom(ec, this.$.editor) && ec.nodeType == 3 && !ec.nextSibling && eo >= ec.textContent.length)
							return ev.preventDefault();
						else
						if(sc.nextSibling && sc.nextSibling.is && sc.isDelimiter && getSelection().isCollapsed)
							forcedelete = toDelete = sc.nextSibling;
						else
						// firefox won't merge the nodes so we do it "manually"
						//if(/firefox|iceweasel/i.test(navigator.userAgent) && this.get("startContainer.parentNode.nextSibling", r) == el)
						if(/firefox|iceweasel/i.test(navigator.userAgent) && sc != this.$.editor && so == 0 && sc.nodeType == 3 && !sc.textContent.length && !sc.nextSibling)
						{
							if(sc.parentNode && sc.parentNode.nextSibling)
							{
								setCaretAt(sc.parentNode.nextSibling, 0);
								sc.parentNode.removeChild(sc);								
							}
						}
						else
						if(/firefox|iceweasel/i.test(navigator.userAgent) && !ec.nextSibling && ec.nodeType == 3 && eo >= ec.textContent.length && this.get("parentNode.nextSibling.firstChild", ec))
						{
							if(ec.parentNode.nextSibling.firstChild.tagName == 'BR')
								ec.parentNode.nextSibling.removeChild(ec.parentNode.nextSibling.firstChild);

							mergeNodes(ec.parentNode, ec.parentNode.nextSibling, true);
							
							if(ec.nextSibling && !INLINE_ELEMENTS[ec.tagName])
								mergeNodes(ec, ec.nextSibling, true);

							ev.preventDefault();
						}
					}
					else
					if(keyCode == 8) // backspace key
					{
						if(!isInLightDom(sc, this.$.editor) && sc.nodeType == 3 && !sc.previousSibling && so == 0)
							return ev.preventDefault();
						else
						if(sc.isDelimiter && sc.previousSibling && sc.previousSibling.is && getSelection().isCollapsed)
							forcedelete = toDelete = sc.previousSibling;
						else
						// firefox won't merge the nodes so we do it "manually"
						if(/firefox|iceweasel/i.test(navigator.userAgent) && sc != this.$.editor && so == 0 && !canHaveChildren(sc) && !sc.previousSibling && sc.parentNode && sc.parentNode.previousSibling)
						{
							if(this.get("parentNode.previousSibling.lastChild", sc)) // neighbouring paragraphs with text nodes
							{
								if(sc.parentNode.previousSibling.lastChild.tagName == 'BR')
								{
									sc.parentNode.previousSibling.removeChild(sc.parentNode.previousSibling.lastChild);
									//if(/^\s*$/.test(sc.parentNode.previousSibling.innerHTML))
									//	sc.parentNode.parentNode.removeChild(sc.parentNode.previousSibling);
								}

								mergeNodes(sc.parentNode.previousSibling, sc.parentNode, true);
								
								if(sc.previousSibling && !INLINE_ELEMENTS[sc.tagName])
									mergeNodes(sc.previousSibling, sc, true);
								
								ev.preventDefault();
							}
							else
							if(sc.parentNode.previousSibling) // inline node before current element
							{
								mergeNodes(sc.parentNode, sc.parentNode.previousSibling);
								if(sc.previousSibling && sc.previousSibling.tagName == 'BR')
									sc.parentNode.removeChild(sc.previousSibling);

								sc.parentNode.normalize();
								ev.preventDefault();
							}
						}
					}

					if(toDelete && toDelete.parentNode && toDelete.nodeType == 1 && (forcedelete || !ev.defaultPrevented))
					{
						if(toDelete.parentNode.firstChild == toDelete && toDelete.parentNode.lastChild == toDelete)
						{
							toDelete = toDelete.parentNode;
						}

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
							mergeNodes(merge.left, merge.right, true);

						this.ensureCursorLocationIsValid();

						ev.preventDefault();

						//this.customUndo.pushUndo();
					}
				}
			}

			altTarget = getTopCustomElementAncestor(ev.target, this.$.editor); // || (ev.target.proxyTarget && ev.target);
			if(ev.type == 'mousedown' && altTarget && this.__actionData.type != 'drag' &&
				!(isInLightDom(ev.target) && (ev.target.nodeType == 3 || (ev.target.firstChild && ev.target.firstChild.nodeType == 3))))
			{
				this.moveTarget.call(this, altTarget);
				ev.preventDefault();
				return;
			}

			if(ev.type == 'drop' && ev.target && getTopCustomElementAncestor(ev.target, this.$.editor)) // || ev.target.proxyTarget)) // prevent default drop (like text) into custom elements - it breaks them
				ev.preventDefault();

			this.selectionSave();

			this._updateValue();
			//getSelectionCoords();
			//this.customUndo.pushUndo();
		},

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
						.replace(/<span[^>]*>\s*<\/span>/g, '')
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

			visitNodes(d, function(el) {
				if(el.nodeType == 1) el.removeAttribute('style') ;
			}, { noRoot : true });

			// edit out eventual closing br
			if(d.lastChild && d.lastChild != d.firstChild && d.lastChild.tagName == "BR")
				d.removeChild(d.lastChild);

			this.pasteHtmlWithParagraphs(d.innerHTML, { removeFormat : false });

			e.preventDefault();
			return false;
		},

		editorMutationHandler : function(mrecs) {
			this.disconnectEditorObserver();

			if(this.editorMutationHandler.paused)
				return;

			var totalVisits = 0, ce, pe, tnc, created, r, sc, so, ec, eo, delimiter, emptyRe, done, upToDate,
				effectiveChanges = [], customEls = this.customElements;

			delimiter = '\u00a0\u00a0';
			emptyRe = /^[\s\u00a0]*$/;

			for(i = 0; i < customEls.length; i++)
				if(!Polymer.dom(customEls[i]).parentNode)
					customEls.splice(i, 1);

			if(this.editorMutationHandler.inProgress) // redundant? check with firefox
				return;

			this.editorMutationHandler.inProgress = true;

			this.observerCycle++;

			if(r = getSelectionRange())
			{
				if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
				if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
			}
			else
				r = {}

			// update this.customElements - list of custom elements
			mrecs.forEach(function(mr) {
				var mrt = mr.target;
				if(!mrt.parentNode)
					return;

				// ignore if node appears more than once in this record - until we actually analyze the record types
				if(mrt.observerCycle == this.observerCycle)
					return;

				mrt.observerCycle = this.observerCycle;

				if(mr.type == "childList" &&
						((mr.addedNodes && mr.addedNodes.length == 1 && mr.addedNodes[0].nodeType == 1 && mr.addedNodes[0].classList.contains('__moignore')) ||
						(mr.removedNodes && mr.removedNodes.length == 1 && mr.removedNodes[0].nodeType == 1 && mr.removedNodes[0].classList.contains('__moignore'))))
						// __moignore identifies the span used for cursor position calculation
					return;
				if(mr.target.nochange)
				{
					mr.target.nochange = false;
					return
				}

				if(mrt.nodeType == 3)
				{
					// process delimiters "detached" from their custom element
					if(mrt.isDelimiter && !((mrt.previousSibling && mrt.previousSibling.is) || (mrt.nextSibling && mrt.nextSibling.is)))
					{
						mrt.isDelimiter = false;
						if(/\u00a0/.test(mrt.textContent))
						{
							mrt.textContent = mrt.textContent.replace(/\u00a0/, '');
							if(mrt == sc)
								setCaretAt(sc, Math.min(so, mrt.textContent.length));
						}
					}
					if(sc == mrt && mrt.isDelimiter && !mrt.isInTransition && so != 1)
						setCaretAt(sc, 1);
					else
					if(!mrt.textContent.length)
						mrt.parentNode.removeChild(mrt);

					if(mrt.textContent.length)
						effectiveChanges.push(mr.target);

					return;
				}

				if(mrt.nodeType != 1)
					return;

				if(mr.addedNodes.length)
					Array.prototype.forEach.call(mr.addedNodes, function(n) { effectiveChanges.push(n) });
				else
					effectiveChanges.push(mr.target);

				if(mr.type == 'childList')
					visitNodes(mrt, function(n) {
						totalVisits++;
						if(n != this.$.editor && !isInLightDom(n, this.$.editor) || !Polymer.dom(n).parentNode)
							return;
						if(n.is && customEls.indexOf(n) == -1)
						{
							customEls.push(n);
							n.setAttribute('contenteditable', false);
						}
					}.bind(this));
			}.bind(this));

			if(effectiveChanges.length)
				this.changed = true;

			var cycles = 0,	cycleLabel = new Date().getTime();

			effectiveChanges.forEach(function(mr) {
				var t = mr, done, cv, cn, ocv, toutline, altp;

				if(t.cycleLabel == cycleLabel) return;
				t.cycleLabel = cycleLabel;

				if(t != this.$.editor && !isInLightDom(t, this.$.editor))
					return;

				ocv = t._cleanValue;

				if(t != this.$.editor)
					t._cleanValue = this.getCleanValue(t);

				if(ocv == t)
					return;

				//done = t == this.$.editor;

				while(!done)
				{

					//	t = t.is ? t.parentNode : t;

					if(t != this.$.editor) {
						if(!t || !isInLightDom(t.parentNode, this.$.editor)) // it's not attached
						{
							altp = Polymer.dom(t).parentNode;
							if(altp != this.$.editor && !isInLightDom(altp, this.$.editor))
								return;
							t = altp;
						}
						else
							t = t.parentNode
					}

					if(t.cycleLabel == cycleLabel) return;
					t.cycleLabel = cycleLabel;

					if(t == this.$.editor)
						done = true;

					ocv = t._cleanValue;

					if(t.nodeType == 3)
						t._cleanValue = t.textContent;
					else
					{
						cn = (t.is ? Polymer.dom(t) : t).childNodes;
						cv = "";
						if(cn)
							cv = Array.prototype.map.call(cn, function(ch) {
								return ch._cleanValue || (ch._cleanValue = this.getCleanValue(ch))
							}.bind(this)).join('');

						if(t != this.$.editor)
						{
							toutline = tagOutline(t);
							toutline = toutline.split(">");
							t._cleanValue = toutline[0] + ">" + cv + toutline[1] + ">";
						}
						else
							t._cleanValue = cv;
					}

					if(ocv == t._cleanValue)
						return;

					cycles++;
				}
			}.bind(this))

			if(cycles > 0)
				this._updateValue();

			//console.log("mutation cycles: ", cycles);

			var parentDelimitersCount = {};


			for(i = 0; i < customEls.length; i++)
			{
				ce = customEls[i];

				pe = Polymer.dom(ce).parentNode;
				if(pe)
				{
					ps = ce.previousSibling;
					ns = ce.nextSibling;

					// pad before
					if(!ps || ps.nodeType != 3) // no text element before
					{
						pe.insertBefore(created = document.createTextNode(delimiter), ce);
						created.isDelimiter = true;
					}
					else // a whitespace text element before
					if(ps.nodeType == 3)
					{
						if(!/\S/.test(ps.textContent))
						{
							if(ps.previousSibling && ps.previousSibling.nodeType == 3)
								ps = mergeNodes(ps.previousSibling, ps, true);

							if(ps.textContent != delimiter && !/\S/.test(ps.textContent))
								ps.textContent = delimiter;

							ps.isDelimiter = true;
						}
						if(sc == ps && ps.isDelimiter && !ps.isInTransition && so != 1 && r.collapsed)
							setCaretAt(ps, 1);
					}

					if(!created && ps.isDelimiter && /\S/.test(ps.textContent)) // remove the padding space if node is not whitespace-only anymore
					{
						ps.textContent = ps.textContent.replace(/[\u200b\u00a0\s]/g, '')
						ps.isDelimiter = false;
						if(sc == ps)
							setCaretAt(ps, Math.min(so, ps.textContent.length))
					}

					created = null;

					// pad after
					if(!ns || ns.nodeType != 3)
					{
						pe[ns ? 'insertBefore' : 'appendChild'](created = document.createTextNode(delimiter), ns);
						created.isDelimiter = true;
					}
					else
					if(ns.nodeType == 3)
					{
						if(!/\S/.test(ns.textContent))
						{
							if(ns.nextSibling && ns.nextSibling.nodeType == 3)
								ns = mergeNodes(ns.nextSibling,ns,true);

							if(ns.textContent != delimiter && !/\S/.test(ns.textContent))
								ns.textContent = delimiter;

							ns.isDelimiter = true;
						}
						if(ec == ns && ns.isDelimiter && !ns.isInTransition && so != 1 && r.collapsed)
							setCaretAt(ns, 1);
					}

					if(!created && ns.isDelimiter && /\S/.test(ns.textContent))
					{
						if(/[\u200b\u00a0\s]/.test(ns.textContent))
							ns.textContent = ns.textContent.replace(/[\u200b\u00a0\s]/g, '')
						ns.isDelimiter = false;
						if(ec == ns)
							setCaretAt(ns, Math.min(eo, ns.textContent.length))
					}

					pe.normalize();

					ce.setAttribute('contenteditable', false);

					// auto-editable lightdom children - should come as a property
					Array.prototype.forEach.call(Polymer.dom(ce).querySelectorAll('.caption'), function(el) { el.setAttribute('contenteditable', true) });
				}
			}

			this.editorMutationHandler.inProgress = false;

			//if(this.SPEED.totalbetweencalls % 100)
			//console.log("th: %s tb: %s time in handler: %s%", this.SPEED.totalinhandler, this.SPEED.totalbetweencalls, 100 * this.SPEED.totalinhandler / this.SPEED.totalbetweencalls)

			this.connectEditorObserver();
		},

		contextMenuShow : function(ev) {
			var cm = this.$.contextMenu, target = ev.target, flowTarget, captionWrapper,
				mediaEditor = this.$.mediaEditor, that = this, altTarget = ev.target, candidateTarget, parentCustomEl,
				actionTarget = target,
				menuGroups = {
						resizeable : "video,img,iframe,embedded-media",
						floatable : "video,img,iframe",
						removeable : "video,img,table,iframe"
				},
				actionableTags = [menuGroups.resizeable, menuGroups.floatable, menuGroups.removeable].join(",");

			cm.disabled = true;

			target = actionTarget = getClosestLightDomTarget(target, this.$.editor);

			parentCustomEl = getTopCustomElementAncestor(target, this.$.editor);
			

			
			if(parentCustomEl)
			{
				ev.stopPropagation();
				ev.stopImmediatePropagation();

				if(Polymer.dom(ev).path.filter(function(el) { return el.is == 'paper-dialog' }).length) // a simplish way to allow setup dialogs
					return;
			}

			if(this.__actionData.target != target)
				this.clearActionData();

			// check whether target is...
			if(!target || target == this.$.editor || // interesting
				!(target.is || target.matchesSelector(actionableTags))) // and actionable /*target.proxyTarget || */
			{
				this.__actionData.showMenuFor = null;
				this.clearActionData();
				return;
			}

			// select target for action
			if(!this.__actionData.target)
				this.selectForAction(actionTarget || target);

			// if target is resizable and wasn't set up do set it up for resize
			if(target.matchesSelector(menuGroups.resizeable) && this.__actionData.resizableTarget != target)
				//(target.proxyTarget.matchesSelector(menuGroups.resizeable)) /*target.proxyTarget && */

				{
					this.resizeTarget(target);

					ev.stopImmediatePropagation();
					ev.stopPropagation();
				}

			// return if just made an action
			if(this.__actionData.lastAction)
				return this.__actionData.lastAction = null;

			if(this.__actionData.showMenuFor != target) // show menu next time
				return this.__actionData.showMenuFor = actionTarget;

			cm.disabled = false;

			ev.screenX = ev.clientX = ev.detail.x;
			ev.screenY = ev.clientY = ev.detail.y;
			ev.preventDefault();

			var imageAction = function(f) {
				return function(param)
				{
					that.resizeTargetStop.call(that, true); // true means force stop dispite the event target being same as current resize target

					if(f)
						f.call(that, param);

					that.clearActionData();
					that._updateValue();
				}
			};

			cm.options = [];

			cm.options.push({label: '',  icon: 'icons:cancel', info: '', value : target, action : imageAction(null)});

			if(target.matchesSelector(menuGroups.resizeable)) // || (target.proxyTarget.matchesSelector(menuGroups.resizeable))) //target.proxyTarget &&
				cm.options.push({label: 'Resize', icon: 'icons:size', info: '', value : target, action : this.resizeTarget.bind(this)});

			cm.options.push({label: 'Remove media',  icon: 'icons:align', info: '', value : target, action : imageAction(this.deleteTarget.bind(this))});

			//if(parentCustomEl && typeof parentCustomEl.setup == 'function')
			//	cm.options.push({label: 'Setup...', value : parentCustomEl, action : parentCustomEl.setup.bind(parentCustomEl)});

			flowTarget = target;

			// target.is || target.matchesSelector(menuGroups.floatable) || (target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.floatable))
			// can only float:
			if((target.is == 'ir-gallery' && Polymer.dom(target).querySelectorAll('img').length == 1) ||    // single-image gallery for now
			/*(target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.floatable)) ||		*/    // proxied elements (iframes)
			(target.matchesSelector(menuGroups.floatable)))												// explicitly floatable elements
			{
				if(captionWrapper = mediaEditor.captionWrapperGet(target))
				  flowTarget = captionWrapper;

				floatOptions = [
					{ label: 'default', value : { target : flowTarget, value : "none" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) },
					{ label: 'Left', value : { target : flowTarget, value : "float-left" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) },
					{ label: 'Right', value : { target : flowTarget, value : "float-right" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) }
				];

				if(target.matchesSelector('img,.caption-wrapper'))
				{
					cm.options.push({label: 'Float', icon: 'icons:align', info: '', options: floatOptions});
					if(captionWrapper)
						cm.options.push({label: 'Remove caption', icon: 'icons:align', value : target, action : imageAction(mediaEditor.captionRemove.bind(mediaEditor))});
					else
						cm.options.push({label: 'Add caption', icon: 'icons:align', info: '', value : target, action : imageAction(mediaEditor.captionSet.bind(mediaEditor))});

					cm.options.push({label: 'More...',  icon: 'icons:align', info: '', value : target, action : imageAction(mediaEditor.open.bind(mediaEditor))});
				}
			}

		  cm._openGroup(ev);
		},

		addActionBorder : function() {
		  var t = this.__actionData.target;

		  if(!t)
			return;

		  t.classList.add('ir-textarea-action');
		},

		removeActionBorder : function() {
		  var t = this.__actionData.target;

		  if(!t)
			return;

 		  t.classList.remove('ir-textarea-action');
		},

		selectForAction : function(target, type) {
		  var ad = this.__actionData;

		  if(this.__actionData.target == target || target.nodeType != 1)
			return;

		  this.clearActionData();

		  this.__actionData.target = target;
		  this.__actionData.type = type;

		  target = getTopCustomElementAncestor(target, this.$.editor);

		  setCaretAt(target.nextSibling, 0);

		  //this.moveCaretAfterOrWrap(target, null, this.$.editor);
		  this.ensureCursorLocationIsValid();

		  this.customUndo.pushUndo(false, false);

		  this.fire('scroll-into-view', this.getSelectionCoords());

		  this.addActionBorder();
		},

		clearActionData : function() {
		  var ad = this.__actionData;

		  this.removeActionBorder();
		  
		  this.$.resizeHandler.style.display = "none";
		  
		  if(ad.target)
			console.log('stopped action:', ad.target);

		  ad.target = ad.lastAction = ad.type = null;


			if( ad.id =='resizable-element') ad.id = '';

		},

		deleteCmd : function() {
			if(this.__actionData && this.__actionData.target)
				this.deleteTarget(this.__actionData.target);
			else
				this.execCommand('delete');
		},

		deleteTarget : function(target) {
			var deleteTarget, p, pce, cover, isCe;

			if(this.__actionData && this.__actionData.target == target)
			{
				target.style.border = this.__actionData.border;
				target = this.__actionData.target;
				this.clearActionData();
			};


			if(!(deleteTarget = getTopCustomElementAncestor(target, this.$.editor)))
				deleteTarget = target;
			else
				this.$.mediaEditor.captionRemove(target);

			p = deleteTarget.parentNode;

			if(p != Polymer.dom(deleteTarget).parentNode) // experimental: if it's a top-level child in a light dom, use Polymer.dom
				isCe = p = Polymer.dom(deleteTarget).parentNode

			if(isCe)
				Polymer.dom(p).removeChild(deleteTarget);
			else
				p.removeChild(deleteTarget);

			this._updateValue();
		},

		resizeTargetStop : function(ev) {

			if(!(ev === true || ev.target != this.__actionData.resizeTarget))
				return;

			var interactable = this.__actionData.interactable,
			target = this.__actionData.resizeTarget;

			document.removeEventListener('mouseup', this.resizeTargetStop);
			document.removeEventListener('click', this.resizeTargetStop);

			if(interactable)
				interactable.unset();

			this.clearActionData();
		},

		resizeTarget : function(target) {
			this.addActionBorder();
			var that = this, resizeHandler, resizeEndHandler, cbr, handlercbr, ep;

			if(this.__actionData.resizableTarget)
				this.resizeTargetStop(true);

			that.__actionData.resizeTarget = target;

			document.addEventListener('mouseup', this.resizeTargetStop.bind(this));
			document.addEventListener('click', this.resizeTargetStop.bind(this));

			cbr = target.getBoundingClientRect();
			if(target.tagName == 'IMG')
			{
				target._aspect = cbr.height / cbr.width;
			}

			if(!target.id)
				target.id = 'resizable-element';

			handlercbr = this.$.resizeHandler.getBoundingClientRect();

			ep = getElementPosition(target, that.$.editor);

			this.$.resizeHandler.style.left = (ep.x + cbr.width - 25) + "px";
			this.$.resizeHandler.style.top = (ep.y + cbr.height - 25) + "px";
			this.$.resizeHandler.style.display = "block";
			
			this.$.resizeHandler.proxyTarget = target;
			
			resizeHandler = function (event) {

				//var target = event.target,
				var bcr, stu,
				computedStyle = target.getBoundingClientRect(),

				x = (parseFloat(target.getAttribute('data-x')) || 0),
				y = (parseFloat(target.getAttribute('data-y')) || 0),


				sw = Number(target.style.width.replace(/px/, '') || 0) || computedStyle.width,
				sh = Number(target.style.height.replace(/px/, '') || 0) || computedStyle.height,
				ratio, w, h;

				if(!target.ratio) // keep the initial ratio on target, as interactible gets regreated on every resize start
					target.ratio = target._aspect; //sh/sw;;

				//if(target._aspect)
				ratio = target.ratio;

				w = event.rect.width;
				h = ratio * w;

				if(target.tagName == 'IMG' && h / ratio > target.width)
					h = target.width * ratio;


				stu = function(w, h)
				{
					// update the element's style
					target.style.width  = w + 'px';
					target.style.height = h + 'px';

					// in case it's a custom element
					target.width = w;
					target.height = h;

					target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px,' + y + 'px)';

					target.setAttribute("width", w);
					target.setAttribute("height", h);
				};

				stu(w, h);

				bcr = target.getBoundingClientRect();

				//if(bcr.width != w || bcr.height !=)
				stu(bcr.width, bcr.height);

				that.__actionData.dragTarget = null; // resize takes over drag

				ep = getElementPosition(target, that.$.editor);
				that.$.resizeHandler.style.left = (ep.x + ep.width - 25) + "px";
				that.$.resizeHandler.style.top = (ep.y + ep.height - 25) + "px";

				// translate when resizing from top or left edges
				//x += event.dy; //y += event.deltaRect.top;
				//console.log(x);
			}

			resizeEndHandler = function() {
			  var t, st, numW, numH;

				that.__actionData.resizeTarget.removeAttribute('data-x');
				that.__actionData.resizeTarget.removeAttribute('data-y');

				that.$.resizeHandler.style.display = "none";

				if(t = st = that.__actionData.resizeTarget)
				{
					st.style.width = t.style.width
					st.style.height = t.style.height
					st.style.webkitTransform = st.style.transform = t.style.transform;
					if(that.__actionData.resizePosition)
						t.style.position = that.__actionData.resizePosition;

					//that.clearActionData();
					that.__actionData.lastAction = "resize";
				}

			}

			interact('#'+target.id).resizable({
				edges: { left: true, right: true, bottom: true, top: true }
			})
			.on('resizemove', resizeHandler)
			.on('resizeend', resizeEndHandler);

			if(target.nextSibling)
				setCaretAt(target.nextSibling, 0);
			else
				setCaretAt(target, 0);
			
			interact('#resizeHandler').on('down', function (event) {
				var interaction = event.interaction,
					handle = event.currentTarget;

				target = that.__actionData.resizeTarget;

				interaction.start({
						name: 'resize',
						edges: {
							top   : handle.dataset.top,
							left  : handle.dataset.left,
							bottom: handle.dataset.bottom,
							right : handle.dataset.right
						}
					},
					interact('#'+target.id),               // target Interactable
					target);   // target Element
			});

			if(!target.style.position || target.style.position == 'static')
			{
				this.__actionData.resizePosition = target.style.position;
				target.style.position = "relative";
			}

		  //this.__actionData.interactable = interactable;
		},

		moveTarget : function(target, done) {
		  var html, actualTarget, handler, caretPosData, moveOccured, tpce;

		  if(this.__actionData.dragTarget && !done)
			return;

		  // calculate drop target and move drag target there
		  if(done)
		  {
			actualTarget = this.__actionData.dragTarget;
			caretPosData = this.__actionData.caretPosData;

			if(caretPosData && caretPosData.node)
			  caretPosData.node = (tpce = getTopCustomElementAncestor(caretPosData.node, editor)) || caretPosData.node;

			if(actualTarget.parentNode && (caretPosData && this.isOrIsAncestorOf(this.$.editor, caretPosData.node)) && !this.isOrIsAncestorOf(actualTarget, caretPosData.node))
			{
			  this.clearActionData();
			  this.__actionData.caretPosData = null;

			  html = recursiveOuterHTML(actualTarget);

			  // for now, forbid explicitly to drop into custom elements. (for custom targets only - built-in text drop is still possible! - e.g., it's ok to move text into a caption inside a gallery)
			  if(tpce)
				this.moveCaretAfterOrWrap(tpce, null, this.$.editor);

			  this.ensureCursorLocationIsValid();

			  this.pasteHtmlAtCaret(html);
			  actualTarget.parentNode.removeChild(actualTarget);

			  moveOccured = true;

			  this.ensureCursorLocationIsValid();
			}
			else
			  this.__actionData.lastAction = null;

			document.removeEventListener('mousemove', this.__actionData.dragMoveListener);
			this.__actionData.dragTarget = null

			return moveOccured;
		  }

		  if(this.__actionData.dragMoveListener)
			document.removeEventListener('mousemove', this.__actionData.dragMoveListener);

		  // track drag target

		  this.__actionData.caretPosData = null;
		  this.__actionData.dragTarget = target;
		  this.__actionData.dragMoveListener = function(event) {
			var ad = this.__actionData;
			var caretPosData = caretPositionFromPoint(event.clientX, event.clientY);

			if(!ad.dragTarget)
			{
			  document.removeEventListener('mousemove', this.__actionData.dragMoveListener);
			  document.removeEventListener('mouseup', this.__actionData.dragStopListener);
			}

			if(!caretPosData)
			{
			  ad.caretPosData = null;
			  return;
			}

			if(!ad.caretPosData || ad.caretPosData.node != caretPosData.node || ad.caretPosData.offset != caretPosData.offset)
			{
			  setCaretAt(caretPosData.node, caretPosData.offset);
			  // this.ensureCursorLocationIsValid();
			  ad.caretPosData = caretPosData;
			  ad.caretPosData.changed = true;
			  this.__actionData.lastAction = 'drag';
			}

		  }.bind(this);

		  this.__actionData.dragStopListener = function(ev) {
			var moveOccured;

			document.removeEventListener('mousemove', this.__actionData.dragMoveListener);
			document.removeEventListener('mouseup', this.__actionData.dragStopListener);

			if(this.__actionData.dragTarget)
			{
			  moveOccured = this.moveTarget.call(this, this.__actionData.dragTarget, true);
			  if(moveOccured)
				ev.preventDefault();
			}
		  }.bind(this);

		  document.addEventListener('mousemove', this.__actionData.dragMoveListener);
		  document.addEventListener('mouseup', this.__actionData.dragStopListener);



		},

		clickedPresetCommand : function(ev) {
		  this.selectionRestore();
		  this.execCommand(ev.target.getAttribute("cmd-name"), ev.target.selected);
		},

		clickedCommand : function(e, presetval) {
		  cmdDef = e.currentTarget.cmdDef;
		  this.execCommand(cmdDef);
		},

		insertHtml : function(e) {
		  this.execCommand("insertHTML", null, this.$.mediaEmbedder);
		},
		createLink : function(e) {
		  this.execCommand("createLink", null, this.$.linkEditor);
		},
		createTable : function(e) {
		  this.execCommand("insertHTML", null, this.$.tableCreator);
		},

		removeFormat : function(element) {
		  function getRangeSelectedNodes(range, includePartiallySelectedContainers) {
			var node = range.startContainer;
			var endNode = range.endContainer;
			var rangeNodes = [];

			// Special case for a range that is contained within a single node
			if (node == endNode) {
			  rangeNodes = [node];
			} else {
			  // Iterate nodes until we hit the end container
			  while (node && node != endNode) {
				rangeNodes.push( node = nextNode(node) );
			  }

			  // Add partially selected nodes at the start of the range
			  node = range.startContainer;
			  while (node && node != range.commonAncestorContainer) {
				rangeNodes.unshift(node);
				node = node.parentNode;
			  }
			}

			// Add ancestors of the range container, if required
			//if (includePartiallySelectedContainers) {
			//  node = range.commonAncestorContainer;
			//  while (node) {
			//    rangeNodes.push(node);
			//    node = node.parentNode;
			//  }
			//}

			return rangeNodes;
		  }

		  function getSelectedNodes() {
			var nodes = [];
			if (window.getSelection) {
			  var sel = window.getSelection();
			  var range = window.getSelection().getRangeAt(0);
			  for (var i = 0, len = sel.rangeCount; i < len; ++i) {
				nodes.push.apply(nodes, getRangeSelectedNodes(sel.getRangeAt(i), true));
			  }
			}
			return nodes;
		  }

		  function replaceWithOwnChildren(el) {
			var parent = el.parentNode, movedChildren = [];

			if(!parent)
			  return;

			while (el.hasChildNodes()) {
			  movedChildren.push(el.firstChild);
			  parent.insertBefore(el.firstChild, el);
			}
			parent.removeChild(el);

			return movedChildren;
		  }

		  function replaceTagName(el, tag) {
			var nn = document.createElement(tag),
			  parent = el.parentNode, ch;

			while (el.hasChildNodes()) {
			  ch = el.firstChild;
			  el.removeChild(ch);
			  nn.appendChild(ch);
			};
			[].forEach.call(el.attributes, function(attr) {
			  nn.setAttribute(attr.name, attr.value);
			});

			parent.insertBefore(nn, el);
			parent.removeChild(el);

			return nn;
		  }

		  function removeSelectedElements(opts, top) {
			var
			  removeTags = opts.removeTags.toLowerCase().split(","),
			  mapTags = {},
			  attrNamesArray = opts.attributeNames.toLowerCase().split(","),
			  root, movedChildren, node, mt;

			Object.keys(opts.mapTags).forEach(function(src) {
			  src.split(',').forEach(function(t) {
				mapTags[t] = opts.mapTags[src];
			  });
			});

			if(opts.root)
			  nodes = [].slice.call(opts.root.children);
			else
			  nodes = getSelectedNodes();

			while(node = nodes.pop())
			{
			  if (node.nodeType == 3)
				node = node.parentNode;

			  if(node && node != top)
			  {
				if(node.children)
				  nodes = nodes.concat([].slice.call(node.children));

				nlc = node.tagName.toLowerCase();
				if (node.nodeType == 1)
				{
				  if(removeTags.indexOf(nlc) > -1) {
					replaceWithOwnChildren(node);
				  }
				  else
				  if(mt = mapTags[nlc]) {
					node = replaceTagName(node, mt);
				  }

				  // clean attributes
				  attrNamesArray.forEach(function(attr) {
					node.removeAttribute(attr)
				  });
				}
			  }
			};
		  }

		  if(!element)
			this.selectionRestore();

		  removeSelectedElements({ root : element.children ? element : null, removeTags : "hr,b,i,span,font", mapTags : { "h1,h2,h3,h4,h5,h6,div" : "p" },  attributeNames : "style,class"}, this.$.editor);
		},

		getElementAfterCaret : function(opts) {
			var i, done,
			r = getSelectionRange(),
			n = r.endContainer, o = r.endOffset;

			opts.skip = opts.skip || [];
			if(!(opts.skip instanceof Array))
				opts.skip = [opts.skip];

			//if(n.nodeType == 1)
			//	n = n.childNodes[o];

			if(n.nodeType == 3 && o < n.length)
				return n;

			n = nextNode(n);
			for(i = 0; n && !done && i < opts.skip.length; i++)
			{
				if(!n.matchesSelector || !n.matchesSelector(opts.skip[i]))
					done = true;
				else
				{
					n = nextNode(n);
					i = -1;
				}
			}

		  return n;
		},

		getElementBeforeCaret : function(opts) {
		  var r = getSelectionRange();

		  opts = opts || {};
		  opts.skipAncestors = true;
		  opts.atomicCustomElements = true;
		  // opts.atomic = ['.embed-aspect-ratio'];

		  if(!r || (!r.startOffset && r.startOffset != 0)  || r.startOffset != r.endOffset)
			return null;

		  if(r.startContainer.nodeType == 1)
			return prevNodeDeep(r.startContainer.childNodes[r.startOffset] || r.startContainer, this.$.editor, opts);
		  else
		  if(!r.startOffset)
			return prevNodeDeep(r.startContainer, this.$.editor, opts);

		  return r.startContainer;
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
				return this.pasteHtmlAtCaret(html);

			// otherwise html contains paragraphs.
			if(!r.collapsed)
			{
				if(r.startContainer.nodeType == 3 && r.startOffset > 0)
					pos = { container : r.startContainer, offset : r.startOffset };
				else
					pos = { container : r.startContainer.parentNode, offset : getChildPositionInParent(r.startContainer) };

				r.deleteContents();

				if(!this.$.editor.childNodes.length)
					setCaretAt(this.$.editor.appendChild(newEmptyParagraph()), 0);
				else
					setCaretAt(pos.container, pos.offset);
			}

			r = getSelectionRange();

			// remove 'br' if is direct child of $.editor
			if(r.startContainer == this.$.editor && r.startContainer.childNodes[r.startOffset].nodeType == 1 && r.startContainer.childNodes[r.startOffset].tagName == 'BR')
			{
				r.startContainer.insertBefore(newEmptyParagraph(), r.startContainer.childNodes[r.startOffset]);
				r = setCaretAt(r.startContainer.childNodes[r.startOffset], 0);
				r.startContainer.parentNode.removeChild(r.startContainer.nextSibling);
			}
			// add empty paragraph if doesn't exist
			if(this.$.editor.childNodes.length == 0)
			{
				this.$.editor.appendChild(newEmptyParagraph());
				r = setCaretAt();
			}
			// move selection range off $.editor on both ends or FF will act funny
			if(r.startContainer == this.$.editor || r.endContainer == this.$.editor)
			{
				sc = r.startContainer, so = r.startOffset;
				if(sc == this.$.editor) sc = r.startContainer.childNodes[r.startOffset], so = 0;
				ec = r.endContainer, eo = r.endOffset;
				if(ec == this.$.editor) ec = r.endContainer.childNodes[r.endOffset], eo = 0;

				r = setCaretAt(sc, so, ec, eo);

				//if(r.startContainer.nodeType == 3 || !r.startContainer.childNodes.length) sc = r.startContainer, so = r.startOffset; else sc = r.startContainer.childNodes[r.startOffset], so = 0;
				//if(r.endContainer.nodeType == 3 || !r.endContainer.childNodes.length) ec = r.endContainer, eo = r.startOffset; else ec = r.startContainer.childNodes[r.startOffset], eo = 0;
			}
			
			// analyze where the caret is in paragraph						
			
			first = r.startContainer;
			firstOffset = r.startOffset;
			if(first.firstChild && (!selfOrLeftmostDescendantIsSpecial(first.childNodes[firstOffset])))
			{
				first = first.childNodes[firstOffset];
				firstOffset = 0;
			}

			firstIsEmptyParagraph = canHaveChildren(first) ? isEmptyParagraph(first) : (first.parentNode && isEmptyParagraph(first.parentNode));
			isNewParagraph = div.childNodes.length == 1 && isEmptyParagraph(div.firstChild);

			if(firstIsEmptyParagraph)
				caretAt.containerStart = true;
			else
				// if it's a bare text/inline node wrap it and its text/inline siblings in paragraph
				if(!isParagraph(first) && (first.nodeType == 3 || INLINE_ELEMENTS[first.tagName]) && first.parentNode == this.$.editor)
				{
					newWrapperParagraph = document.createElement('span');
					newWrapperParagraph.classList.add('paragraph');
					firstToWrap = first;

					// go back until paragraph/block element/container start
					while(!isParagraph(firstToWrap.previousSibling) && (firstToWrap.previousSibling && (firstToWrap.previousSibling.is || firstToWrap.previousSibling.nodeType == 3 || INLINE_ELEMENTS[firstToWrap.previousSibling.tagName])))
						firstToWrap = firstToWrap.previousSibling;

					container = firstToWrap.parentNode;
					index = getChildPositionInParent(firstToWrap);

					// go forward and wrap anything until next paragraph/block element and wrap
					while(!isParagraph(firstToWrap) && (firstToWrap && (firstToWrap.is || firstToWrap.nodeType == 3 || INLINE_ELEMENTS[firstToWrap.tagName])))
					{
						newWrapperParagraph.appendChild(firstToWrap)
						firstToWrap = container.childNodes[index];
					}
					firstIsEmptyParagraph = isEmptyParagraph(newWrapperParagraph);

					if(index < container.childNodes.length)
						container.insertBefore(newWrapperParagraph, container.childNodes[index]);
					else
						container.appendChild(newWrapperParagraph);

					if(first.nodeType == 1)
						firstOffset = getChildPositionInParent(first);
				}

			// wrap bare nodes 
			
			container = first;
			// find first praragraph or non-text, non-inline container. it could have been the editor but we wrapped bare nodes earlier
			while(!isParagraph(container) && (container.nodeType == 3 || INLINE_ELEMENTS[container.tagName] || isSpecialElement(container)))
				container = container.parentNode;

			if(caretAt.containerStart || (container.firstChild == first && firstOffset == 0))
				caretAt.containerStart = true;
			else
			{
				pos = getLastCaretPosition(container);
				if(pos.container == first && pos.offset == firstOffset && (!first.nextSibling && !(first.nextSibling == first.parentNode.lastChild && first.nextSibling.tagName == 'BR'))) // last condition prevents ignoring elements that can't have children implied by getLastCaretPosition
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
					pos = getLastCaretPosition(lastInserted);
					setCaretAt(lastInserted, pos.offset);
					//if(!container.textContent)
					//	container.parentNode.removeChild(container);
				}
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

				pos = getLastCaretPosition(lastInserted);
				setCaretAt(pos.container, pos.offset);
			}
			else // containerMiddle
			{
				if(first.tagName == 'BR') // remember we are in the middle of a paragprah so prevSibling exists
				{
					first = first.previousSibling;
					first.parentNode.removeChild(first.nextSibling);
					if(canHaveChildren(first))
					{
						pos = getLastCaretPosition(first);
						first = pos.container;
						firstOffset = pos.offset;
					}
					else
					{
						firstOffset = getChildPositionInParent(first);
						first = first.parentNode;
					}
				}

				if(!selfOrLeftmostDescendantIsSpecial(first)) // first is custom element 
					last = splitNode(first, firstOffset, container);
				else
				if(first.parentNode != this.$.editor)
					last = splitNode(first.parentNode, getChildPositionInParent(first), container);
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

				if(!isNewParagraph || (sp = selfOrLeftmostDescendantIsSpecial(last)) || !last)
				{
					if(sp && !selfOrLeftmostDescendantIsSpecial(first))
						lastInserted = first;
					else
						while(div.firstChild)
							lastInserted = first.parentNode[last ? 'insertBefore' : 'appendChild'](div.firstChild, last);

					pos = getLastCaretPosition(lastInserted);
					return setCaretAt(pos.container, pos.offset);
				}
				return setCaretAt(last, 0);
			}
		},

		pasteHtmlAtCaret : function(html, removeFormat, keepLastBr) {
			var sel, range, endNode, newRange, node, lastNode, preLastNode, el, frag, pos, isLastInEditor, target, pos, offset, sc, so, ec, eo, r;

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
					r = setCaretAt(sc, so, ec, eo);

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

						r = setCaretAt(r.startContainer, r.startOffset-1)

					r.insertNode(frag);

					// Preserve the selection
					if (lastNode) {
						if(lastNode.nextSibling && lastNode.nextSibling.textContent == '' && !keepLastBr)
							lastNode.parentNode.removeChild(lastNode.nextSibling);
						if(lastNode.nextSibling && lastNode.nextSibling.tagName == 'BR' && !keepLastBr)
							lastNode.parentNode.removeChild(lastNode.nextSibling);

						t = lastNode;
						while(t.parentNode && t.parentNode != this.$.editor)
							t = t.parentNode;

						offset = 0;
						if(t.parentNode == this.$.editor && !t.nextSibling)
							t.parentNode.appendChild(target = newEmptyParagraph());
						else
						{
							pos = getLastCaretPosition(lastNode);
							if(!pos)
								target = nextNode(lastNode, true);
							else
							{
								target = pos.container;
								offset = pos.offset;
							}
						}

						return setCaretAt(target, offset);
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
		},

		// to use instead of execCommand('insertHTML') - modified from code by Tim Down
		insertHTMLCmd : function (html) {
			//this.selectionRestore();

			var ef = html.match(/\<p[^\>]+\>/) ? ["p"] : [];
			var r, after;

			this.ensureCursorLocationIsValid({ extraForbiddenElements : ef });
			this.pasteHtmlWithParagraphs(html);

			this.ensureCursorLocationIsValid();
			this._updateValue()
		},


		_execCommand : function(cmd, sdu, val) {
			var that = this;

			this.ensureCursorLocationIsValid();

			if(cmd == 'replaceHTML')
				this.insertHTMLCmd(val, true);
			else
			if(cmd == 'insertHTML')
				this.insertHTMLCmd(val);
			else
			if(cmd == 'paste') {
				that.$.editor.focus();
				that.selectionRestore();
				setTimeout(function() {
					document.execCommand('Paste');
				}, 300);
			}
			else {
				if(this.isCommandPossible(cmd, sdu, val)) {
					document.execCommand(cmd, sdu, val);
					this.selectionSave();
					setTimeout(function(){
						that.selectionRestore();
					}, 200);
				}
			}
		},

		isCommandPossible : function(cmd, sdu, val) {
			var r = this.selectionRestore(), sc = r.startContainer, ec = r.endContainer, so = r.startOffset, eo = r.endOffset, nn;

			// currently only

			// 1. prevents bullet list (insertUnorderedList) on ranges containing a custom element, Chromium bug 571420
			if(cmd=='insertUnorderedList' && sc != ec)
			{
				nn = sc;
				while(nn && nn != this.$.editor && nn != ec) {
					if(!isInLightDom(nn, this.$.editor)) {
						alert('Creation of bulleted list on ranges containing custom elements is not supported due to a but in Chrome (see Chromium bug 571420). As a workaround, create the bulleted list and drag the element there instead.');
						return false;
					}
					nn = nextNode(nn);
				}
			}

			return true;
		},


		getSelectionHtml: function () {
			var html = "";
			if (typeof window.getSelection != "undefined") {
				var sel = window.getSelection();
				if (sel.rangeCount) {
					var container = document.createElement("div");
					for (var i = 0, len = sel.rangeCount; i < len; ++i)
						container.appendChild(sel.getRangeAt(i).cloneContents());

					html = container.innerHTML;
				}
			}
			else
			if (typeof document.selection != "undefined") {
				if (document.selection.type == "Text") {
					html = document.selection.createRange().htmlText;
				}
			}
			return html;
		},

		insertPlugins: function(){
			var dynamicEl, par;
			var plugins = this.plugins;
			for (var i = 0; i < plugins.length; i++) {
				dynamicEl = document.createElement(plugins[i].name);
				par = Polymer.dom(this.root).querySelector(plugins[i].insertin);
				Polymer.dom(par).appendChild(dynamicEl);

			}

		},

		execCommand : function(cmdDefOrName, presetVal, promptProcessor)
		{
			var that = this, cmdDef = cmdDefOrName, actualCmd, val, ext,test,result;

			if(typeof cmdDef == 'string')
				cmdDef = (window.ir.textarea.commands.filter(function(c) { return c.cmd == cmdDef }))[0] || { fakeCmd : cmdDef };

			var actualCmd = cmdDef.fakeCmd || cmdDef.cmd;

			promptProcessor = promptProcessor || (this.promptProcessors[actualCmd] && document.getElementById(this.promptProcessors[actualCmd]));

			this.selectionRestore();

			if(!presetVal && promptProcessor)
			{
				promptProcessor.prompt(function(val) {
					var ext, isHtml = /</.test(val);

					that.selectionRestore();

					if(!isHtml)
					{
						ext = val.match("([^\.]+)$");
						ext = ext ? ext[1] : "";
					}
					if(actualCmd =='insertImage' && ext && ext.match(/(mp4|ogg|webm|ogv)$/i)){
						val = "<video controls ><source src='" + val + "' type='video/" + ext + "'></video>"
						//document.execCommand("insertHTML", false, val);
						that.insertHTMLCmd(" ", val, " ");
					}
					else if(actualCmd =='insertImage' && isHtml){
						that.insertHTMLCmd(val);
					}
					else{
						if(val)
						{
							that._execCommand(actualCmd, false, val);
							that.$.editor.focus();

							//that.selectionForget();
						}
					}

					Polymer.dom.flush();
					this.async(function() {
						that.ensureCursorLocationIsValid();
						that.$.editor.focus();
						that._updateValue();
					})
				});

				return;
			}

			this.async(function() {
				var val, ext;

				if(presetVal)
					val = presetVal;
				else
				if(cmdDef.val)
					val = prompt(cmdDef.val);

				if(actualCmd =='insertImage' && (ext = val.match(/\.(mp4|ogg|webm|ogv)$/i))){
					ext = val.match("([^\.]+)$")[1];

					val = "<video controls><source src='" + val + "' type='video/" + ext + "'></video>"
					this.insertHTMLCmd(val);
				}

				if(!presetVal && cmdDef.val)
					this._execCommand(actualCmd, false, prompt(cmdDef.val));
				else
					this._execCommand(actualCmd, false, presetVal);

				this.$.editor.focus();
				this._updateValue();
			});
		},

		selectionSave : function () {
			var range = getSelectionRange();

			if(range && this.isOrIsAncestorOf(this.$.editor, range.startContainer))
				this._selectionRange = range;
		},

		selectionRestore : function (noForceSelection) {
			var range, sel, sc, ec;

			range = getSelectionRange();

			// console.log('selectionRestore called from: ', arguments.callee.caller.name);

			if(range && this.isOrIsAncestorOf(this.$.editor, range.startContainer))
			{
				if(!this.isOrIsAncestorOf(this.$.editor, document.activeElement))
					this.$.editor.focus();

				return range;
			}

			range = this._selectionRange

			if(range) {
				sc = range.startContainer;
				ec = range.endContainer;
			}

			if (range && sc && ec && this.isOrIsAncestorOf(this.$.editor, sc) && this.isOrIsAncestorOf(this.$.editor, ec)) {
				if (window.getSelection) {
					sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (document.selection && range.select) {
					range.select();
				}

				this.$.editor.focus();
			}
			else
			if(!noForceSelection)
			{
				// if no selection, go to offset 0 of first child, creating one if needed
				if(!this.$.editor.childNodes.length)
					setCaretAt(this.$.editor.appendChild(newEmptyParagraph()), 0);
				else
					setCaretAt(this.$.editor.childNodes[0], 0);
			}

			this._selectionRange = range;

			return range;
		},

		selectionForget : function() {
			this._selectionRange = null;
		},

		// a list of functions where each function enforces a single rule.
		// if applicable the rule will usually modify the selection range and return true, and all the rules will be re-executed
		// the rules are executed by ensureCursorLocationIsValid
		cursorRules : [
			function inEditor(opts, range) {
				var sc, ec;

				if(range)
				{
					sc = range.startContainer,
					ec = range.endContainer;
				}

				if(!range || !this.isOrIsAncestorOf(this.$.editor, sc) || !this.isOrIsAncestorOf(this.$.editor, ec)) {
					if(opts.originalEvent && (opts.originalEvent.type == 'mouseup' || opts.originalEvent.type == 'mousedown'))
						r = caretPositionFromPoint(opts.originalEvent.clientX, opts.originalEvent.clientY);
					else
						this.selectionRestore();
					return true;
				}
			}
		],

		ensureCursorLocationIsValid : function(opts) { // if reverseDirection is true cursor is moving in reverse to typing direction
			return; // obsolete

			/*var r, i, sp, sc, ec, so, eo, totalChecks = 0, jumpsOccured = 0;

			opts = opts || {};

			opts.extraForbiddenElements = opts.extraForbiddenElements || [];

			for(i = 0; i < this.cursorRules.length && totalChecks++ < 50; i++)
				if(this.cursorRules[i].call(this, opts, r = getSelectionRange()))
				{
					i = -1;
					jumpsOccured++;
				}

			if(totalChecks >= 50)
				return console.error('too many cursor movements');

			this.selectionSave();
			this.fire('scroll-into-view', this.getSelectionCoords());*/
		},

		getSelectionCoords : function() {
			var c;
			this.editorMutationHandler.paused = true;
			c = getSelectionCoords();
			this.editorMutationHandler.paused = false;

			return c;
		},

		selectionSelectElement : function(el) {
			var range = document.createRange();
			range.selectNode(el);
			var sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);

			return range;
		},

		// wraps content in <p><br></p>[content]<p><br></p>
		frameContent : function() {
			return; // obsolete
			
			/*
			var ed = this.$.editor, nn, i, d, lastBeforeSkip, r;


			if(!ed.childNodes.length)
				return setCaretAt(ed.appendChild(newEmptyParagraph()), 0)

			if(!isEmptyParagraph(ed.childNodes[0]))
			{
				if(ed.childNodes[0] && ed.childNodes[0].matchesSelector && ed.childNodes[0].matchesSelector('span.paragraph') && !ed.childNodes[0].innerHTML)
				{
					if(ed.childNodes.length == 1)
						ed.childNodes[0].innerHTML = '<br>'
					else
					{
						if((getSelectionRange() || {}).startContaier == ed.childNodes[0])
							setCaretAt(ed.childNodes[1], 0);

						ed.removeChild(ed.childNodes[0]);
					}

				}
				else
				if(selfOrLeftmostDescendantIsSpecial(ed.childNodes[0]))
					ed.insertBefore(newEmptyParagraph(), ed.childNodes[0]);
			}

			lastBeforeSkip = ed.lastChild;

			if(ed.childNodes.length == 1 || !isEmptyParagraph(lastBeforeSkip))
			{
				if(lastBeforeSkip == ed.lastChild)
					ed.appendChild(newEmptyParagraph());
				else
					ed.insertBefore(newEmptyParagraph(), lastBeforeSkip.nextSibling);
			}
			
			*/
		},

		_updateValue : function(force) {
			if(this._updateValueTimeout)
			{
				this._updateValueTime = new Date().getTime();

				clearTimeout(this._updateValueTimeout);
				this._updateValueTimeout = null;
			}

			if(!this._updateValueTime || this._updateValueTime - (new Date().getTime()) > 300)
			{
				this.selectionRestore();
				this.customUndo.pushUndo();
				this._updateValueTime = new Date().getTime();
			}

			this._updateValueTimeout = setTimeout(function() {
				var p;
				
				this.customUndo.pushUndo();
				
				r = getSelectionRange();

				if(!r)
					return;

				p = r.startContainer;
				while(p)
				{
					if(p.is == 'paper-dialog')
						return;
					if(p == this.$.editor)
					{
						return this.fire('scroll-into-view', this.getSelectionCoords());
					}
					p = p.parentNode;
				}

				//if(r && this.isOrIsAncestorOf(this.$.editor, r.startContainer))
				//	this.fire('scroll-into-view', this.getSelectionCoords());

			}.bind(this), 300);

			var val, sameContent, d, r;
			var bottomPadding, topPadding, that = this, editor = this.$.editor;

			if(this.__actionData.target)
				this.__actionData.target.style.border = this.__actionData.border;

			if(this.changed)
			{
				val = this.getCleanValue();
				this.changed = false;
			}
			else
				val = this.value;

			this._updateValueTimeout = null;

			this.selectionSave();

			this.value = val;

			this.textValue = this.$.editor.textContent;

			if(val != this._initialValue)
				this.fire('change');
			else
				this.fire('unchange');

			this.$.editor.style.minHeight = this.$.editor.scrollHeight + "px";
		},

		getCleanValue : function(from) {
			var v;
			this.removeActionBorder();

			from = from || this.$.editor;

			if(from == this.$.editor && this.$.editor._cleanValue)
				return this.$.editor._cleanValue;

			if(from == this.$.editor)
				v = recursiveInnerHTML(from)
			else
				v = recursiveOuterHTML(from)

			if(from == this.$.editor)
			{
				v = v
					.replace(/^(\r\n|\n|\r)/,"")
					.replace(/(\r\n|\n|\r)/gm," ")
					.replace(/\<pre\>/gmi,"<span>").replace(/\<\/?pre\>/gmi,"</span>");

				v = v.trim();
			}

			this.addActionBorder();

			return v;
		},

		_focusedEditor : function() {
			//this.selectionRestore();
		},

		_blurredEditor : function() {
			this.selectionSave();
		},

		getCaretCharacterOffset : function getCaretCharacterOffset() {
			// modified from code by Tim Down http://stackoverflow.com/users/96100/tim-down
			var element = this.$.editor;
			var caretOffset = 0;
			var doc = element.ownerDocument || element.document;
			var win = doc.defaultView || doc.parentWindow;
			var sel;
			if (typeof win.getSelection != "undefined") {
				sel = win.getSelection();
				if (sel.rangeCount > 0) {
					var range = win.getSelection().getRangeAt(0);
					var preCaretRange = range.cloneRange();
					preCaretRange.selectNodeContents(element);
					preCaretRange.setEnd(range.endContainer, range.endOffset);
					caretOffset = preCaretRange.toString().length;
				}
			} else if ( (sel = doc.selection) && sel.type != "Control") {
				var textRange = sel.createRange();
				var preCaretTextRange = doc.body.createTextRange();
				preCaretTextRange.moveToElementText(element);
				preCaretTextRange.setEndPoint("EndToEnd", textRange);
				caretOffset = preCaretTextRange.text.length;
			}

			this.selection = {
				caretOffset : caretOffset
			}

			return caretOffset;
		},

		// params: slc - range start node, elc - range end node
		// if slc != elc will select from before slc to after elc
		// otherwise will set caret after slc
		moveCaretAfterOrWrap : function(slc, elc, top) {
			var ns, sel = window.getSelection(), range = document.createRange(), tc;

			if(!elc)
				elc = slc;

			if(slc != elc)
			{
				range.setStartBefore(slc);
				range.setEndBefore(slc);
				sel.removeAllRanges();
				sel.addRange(range);

				return range;
			}

			ns = nextNode(slc, false);
			while(ns && ns.parentNode && getTopCustomElementAncestor(ns, top) && !(isInLightDom(ns, top) && ns.nodeType == 3))
				ns = nextNode(ns, false);

			if(slc.is && ns == slc.nextSibling)
			{
				//if(ns.nextSibling.nodeType == 3)
				tc = slc.nextSibling;
				if(!tc.nodeType == 3)
				{
					console.error('Custom element is missing a text wrapper: ', slc.previousSibling, slc, slc.nextSibling)
					throw Error('Custom element is missing a text wrapper: ' + tc.tag);
				}
				return setCaretAt(ns, /^\u0020/.test(ns.textContent) ? 1 : 0);
			}

			return setCaretAt(ns, 0);
		},

		moveCaretBeforeOrWrap : function(slc, elc, top) {
			var pos, ns, sel = window.getSelection(), range = document.createRange(), isSibling = true;

			if(slc == elc)
			{
				range.setStartBefore(slc);
				range.setEndBefore(slc);
				sel.removeAllRanges();
				sel.addRange(range);

				return range;
			}

			ns = prevNodeDeep(slc, false);
			isSibling = Polymer.dom(ns).parentNode == Polymer.dom(slc).parentNode;
			while(ns && ns != top && getTopCustomElementAncestor(ns, top) && !(isInLightDom(ns, top) && ns.nodeType == 3))
			{
				ns = prevNodeDeep(ns, false);
				if(isSibling)
					isSibling = Polymer.dom(ns).parentNode == Polymer.dom(slc).parentNode;

				tc = ns.previousSibling;

				if(/\u0020$/.test(tc.textContent))
					setCaretAt(ns, 1);
			}

			pos = getLastCaretPosition(ns);
			if(!pos)
				pos = { container : ns, offset : getChildPositionInParent(ns) }

			return setCaretAt(pos.container, pos.offset);
		},

		cleanHTML : function() {
			this.set("value", this.$.editor.innerHTML = HTMLtoXML(this.value));
			this._updateValue(true);
		},

		undo : function() {
			this.selectionRestore();
			this.customUndo.undo();
			this.selectionSave();
		},
		redo : function() {
			this.selectionRestore();
			this.customUndo.redo();
			this.selectionSave();
		},

	  _onAnimationFinish: function() {
		  if (this._showing) {
		  } else {
			  //this.style.display = '';
			  this.$.toolbar.classList.remove('fixit');
		  }
	  },
	  show: function() {
		  //this.$.toolbar.style.display = 'inline-block';
		  this.$.toolbar.classList.add('fixit');
		  this._showing = true;
		  this.playAnimation('entry');
		  this.set('isToolbarHidden', false)
	  },
	  hide: function() {

		  this._showing = false;
		  this.playAnimation('exit');

	  },
	  hideToolbar: function(){
		  this.hide();
	  },

		viewModeChanged : function() {
			if(this.viewMode == 1)
				Polymer.dom(this.$.preview).innerHTML = this.value; //
		},

		properties : {
			commands : {
				type : String,
				value : "bold,italic,underline,insertOrderedList,insertUnorderedList,align-left,justifyLeft,justifyCenter,justifyRight,indent,outdent,insertHorizontalRule,,insertImage,foreColor,backColor,,copy,cut"
			},

			customUndo : {
				type : Object
			},

			promptProcessors : {
				type : Object,
				value  : {}
			},

			customUndo : {
				type : Object
			},

			plugins : {
				type : Object,
				value  : {}
			},

			viewMode : {
				type : Number,
				value : 0,
				observer : "viewModeChanged"
			},

			value : {
				type : String,
				notify : true
			},

			textValue : {
				type : String,
				value : ''
			},

			toolbarfix : {
				type: String,
				value: 'nofix',
				notify : true
			},
			toolbarstyle : {
				type: String,
				value: 'nofix',
				notify : true
			},
			isToolbarHidden:{
				type: Boolean,
				value: true
			},
			animationConfig: {
				type: Object,
				value: function() {
					return {
						'entry': [{
							name: 'slide-from-top-animation',
							node: this.$.toolbar,
							transformOrigin: '0 0'
						}],
						'exit': [{
							name: 'slide-up-animation',
							node: this.$.toolbar
						}]
					}
				}
			},
			_showing: {
				type: Boolean,
				value: false
			}
		},

		behaviors: [
			ir.ReflectToNativeBehavior,
			ir.SelectorBehavior,
			Polymer.NeonAnimationRunnerBehavior
		],

	  listeners: {
		  'neon-animation-finish': '_onAnimationFinish'
	  },


	})

	// custom undo engine
	function CustomUndoEngine(editor, options)  {
		var undoRecord = [],
			redoRecord = [],
			lastRestoredStateContent,
			getValue = options.getValue || function() { return editor.innerHTML },
			undoInProgress;

		if(!options) options = {};
		if(!options.maxUndoItems) options.maxUndoItems = 50;
		if(typeof options.timeout == 'undefined') options.timeout = 15000;

		var undoCommand = function() {
			var sel, r, lastUndo, lur, currState;

			if(!undoRecord.length)
				return;

			currState = undoRecord[undoRecord.length - 1];

			if(undoRecord.length > 1)
				redoRecord.push(undoRecord.pop());

			lastUndo = undoRecord[undoRecord.length - 1];

			if(!lastUndo || (lastUndo.content == currState.content && undoRecord.length > 1))
				return;

			restoreState(lastUndo);

			lastRestoredStateContent = lastUndo.content;
		}

		var redoCommand = function(e) {
			var sel, r, lastRedo = redoRecord.pop();

			if(lastRedo)
			{
				restoreState(lastRedo);
				//pushUndo(true);
				undoRecord.push(lastRedo);
				lastRestoredStateContent = lastRedo.content;
			}
		}

		var restoreState = function(state)
		{
			var r;

			undoInProgress = true;
			r = state.restore(true); // true means to restore caret state
			undoInProgress = false;

			if(options.onRestoreState && r)
				options.onRestoreState(r.startContainer);
		}

		var pushUndo = function(force) { //, onlyUpdateRangeMemo) {
			var r, sel = window.getSelection(), startMemo, endMemo, sc, ec, so, eo, t,
				innerHTML, onlyUpdateRangeMemo, prevUndo;

			if(undoInProgress)
				return;

			innerHTML = getValue();
			onlyUpdateRangeMemo = false;

			if(undoRecord.length > 2 && (undoRecord[undoRecord.length-1].content == innerHTML))
				onlyUpdateRangeMemo = true;

			lastRestoredStateContent == null;

			while(undoRecord.length >= options.maxUndoItems)
				undoRecord.shift();

			prevUndo = undoRecord.length && undoRecord[undoRecord.length - 1];
			if(prevUndo && onlyUpdateRangeMemo)
				prevUndo.updateRange();
			else
				undoRecord.push(new UndoItem(editor, innerHTML, prevUndo));

			//console.log("sc: %s, so: %s, spos: %s, ec: %s, eo: %s, epos: %s, total undo+redo: %s", sc, so, JSON.stringify(startMemo.positionArray), ec, eo, JSON.stringify(endMemo.positionArray), undoRecord.length + redoRecord.length);

			//}

			if(!force && !onlyUpdateRangeMemo && redoRecord.length > 0 && lastRestoredStateContent != innerHTML)
				redoRecord = [];
		};


		editor.addEventListener('keydown', function(e) {
			if(e.keyCode == 90 && e.ctrlKey) // is ^z
			{
				undoCommand();
				e.preventDefault();
			}
			if(e.keyCode == 89 && e.ctrlKey) // is ^y
			{
				redoCommand();
				e.preventDefault();
			}
		})

		if(options.timeout)
			setInterval(pushUndo, options.timeout);

		//pushUndo(true);

		return {
			pushUndo : pushUndo,
			undo : undoCommand,
			redo : redoCommand,
			undoRecord : undoRecord,
			redoRecord : redoRecord,
		}
	}

	// dom/range utility functions

	var recursiveInnerHTML = function(el, skipNodes) {
		skipNodes = skipNodes || [];

		if(!((el.is ? Polymer.dom(el) : el).childNodes.length))
			return "";

		return Array.prototype.map.call((el.is ? Polymer.dom(el) : el).childNodes, function(node) {
				if(node.isDelimiter)
					return "";
				if(skipNodes && skipNodes.indexOf(node) > -1)
					return "";

				if((node.is ? Polymer.dom(node) : node).childNodes.length)
					return recursiveOuterHTML(node, skipNodes);
				else
					return tagOutline(node);
			}).join('');
	}

	// by Nathan P. Cole from http://stackoverflow.com/questions/3158274/what-would-be-a-regex-for-valid-xml-names
	function isXMLTagName ( tag ) // returns true if meets cond. 1-5 above
	{
		var t = !/^[xX][mM][lL].*/.test(tag); // condition 3
		t = t && /^[a-zA-Z_].*/.test(tag);  // condition 2
		t = t && /^[a-zA-Z0-9_\-\.]+$/.test(tag); // condition 4
		return t;
	}
	var isCustomElementName = (function(n) {
		var cache = {};
		return function(tagName) {
			var c = cache[tagName];
			if(c)
				return c;
			else
				return cache[tagName] = isXMLTagName(tagName) && !!document.createElement(tagName).is;
		}
	})();

	var cloneCustomElement = function(el) {
		var n = document.createElement(el.tagName), a;
		for(i = 0; i < el.attributes.length; i++)
		{
			a = el.attributes[i];
			n.setAttribute(a.name, a.value);
		}
		n.innerHTML = recursiveInnerHTML(el);
		return n;
	}

	var tagOutline = function(el){ // effectively outerHTML - innerHTML
		var nn = el.cloneNode(false),
			d = document.createElement('div'),
			classList;

		if(el.isDelimiter) return '';

		if(nn.classList)
		{
			var classList = Array.prototype.map.call(nn.classList, function(n){return n});

			classList.forEach(function(cl) { if(isCustomElementName(cl)) nn.classList.remove(cl); });
			nn.classList.remove('style-scope');
			nn.removeAttribute('contenteditable');
			if(!nn.classList.length) nn.removeAttribute("class");
		}


		d.appendChild(nn);

		while(nn.childNodes.length)
			nn.removeChild(nn.childNodes[0]);

		return d.innerHTML;
	}

	var recursiveOuterHTML = function(node, skipNodes){
		var outerHTML, innerHTML, childNodes, res;

		if(node.isDelimiter)
			return "";

		if(skipNodes && skipNodes.indexOf(node) > -1)
			return "";

		if(node.nodeType == 3)
			return node.textContent;

		childNodes = node.is ? Polymer.dom(node).childNodes : node.childNodes;
		if(!childNodes.length)
			return tagOutline(node);

		innerHTML = (node.is && node.originalInnerHTML) ? node.originalInnerHTML : Array.prototype.map.call(childNodes, function(n) { return recursiveOuterHTML(n, skipNodes) }).join('');

		res = tagOutline(node)
		if(innerHTML)
			res = res.replace(/(\<[^\>]+\>)/, function(m) { return m + innerHTML })

		return res;
	}

	// if node is in light dom tree will return the node,
	// otherwise will return the closest parent custom element that is in light dom
	var getClosestLightDomTarget = function(node, top) {
		var customParents = [], cn, n = node, i, goDeeper;

		while(n && n != top && n != document)
		{
			if(isInLightDom(n, top))
				return n;

			n = n.parentNode;
		}

		return n;
	}

	var isInLightDom = function(node, top) { // is in light dom relative to top, i.e. top is considered the light dom root like a scoped document.body
		if(!node)
			return false;

		if(node.parentNode == top)
			return true;

		if(node != top && node != document.body)
			return isInLightDom(Polymer.dom(node).parentNode, top);

		return false;
	}

	// returns topmost custom element or null below or equal to `top`
	var getTopCustomElementAncestor = function(node, top) {
		var res = null;
		if(!top) top = document.body;

		while(node && node != top)
		{
			if(node.is)
				res = node;

			if(Polymer.dom(node).parentNode != node.parentNode && !isInLightDom(node, top))
				node = Polymer.dom(node).getOwnerRoot().host;
			else
				node = node.parentNode;
		}

		return (node == top) ? res : null;
	}

	// DomPathMemo - remember and restore child via an array of childNode order path - used in undo
	var getDomPathMemo = function(child, ancestor) {
		return new DomPathMemo(child, ancestor);
	}

	var DomPathMemo = function(child, ancestor) {
		this.ancestor = ancestor;
		this.positionArray = getChildPathFromTop(child, ancestor);
	}

	DomPathMemo.prototype.restore = function() {
		return getChildFromPath(this.positionArray, this.ancestor);
	};

	var RangeMemo = function(root) {
		var r = getSelectionRange(), sc, ec, so,eo,cps, cpe, lps, lpe, cn;

		this.root = root;

		if(r) {
			sc = r.startContainer;
			ec = r.endContainer;
			so = r.startOffset;
			eo = r.endOffset;
		}

		if(r && sc.proxyTarget) // same name new animal
			sc = ec = sc.proxyTarget.nextSibling, so = eo = 0;

		if(!r || !isDescendantOf(sc, root) || (sc != ec && !isDescendantOf(ec, root)))
		{
			this.startPos = this.endPos = [];
			this.startOffset = this.endOffset = 0;

			return;
		}

		 if(isDescendantOf(sc, root) && isDescendantOf(ec, root))
			 
		
		if(sc != root && !isInLightDom(sc, root))
			sc = getTopCustomElementAncestor(sc, root).nextSibling, so = 0;
		if(ec != root && !isInLightDom(ec, root))
			ec = getTopCustomElementAncestor(ec, root).nextSibling, eo = 0;

		cps = getChildPathFromTop(sc, root);
		cpe = getChildPathFromTop(ec, root);

		if(sc.nodeType == 3 && sc.textContent.length == 0)
			this.startIsEmpty = true;

		this.root = root;
		this.startPos = cps;
		this.endPos = cpe;
		this.startOffset = so;
		this.endOffset = eo;
	}
	RangeMemo.prototype.clone = function(rangeMemo) {
		var c = new RangeMemo();
		c.root = this.root;
		c.startPos = this.startPos;
		c.endPos = this.endPos;
		c.startOffset = this.startOffset;
		c.endOffset = this.endOffset;
		return c;
	}
	RangeMemo.prototype.isEqual = function(domPathMemo) {
		var i;

		if(this.root != domPathMemo.root)
			return false;

		if(this.startOffset != domPathMemo.startOffset || this.endOffset != domPathMemo.endOffset)
			return false;

		for(i = 0; i < this.startPos.length; i++)
			if(this.startPos[i] != domPathMemo.startPos[i])
				return false;

		for(i = 0; i < this.endPos.length; i++)
			if(this.endPos[i] != domPathMemo.endPos[i])
				return false;

		return true;
	}
	RangeMemo.prototype.restore = function(doSetCaret)
	{
		var s = window.getSelection(),
			r = document.createRange(),
			sc = getChildFromPath(this.startPos, this.root),
			ec = getChildFromPath(this.endPos, this.root);

		if(!sc || !ec)
			return null;

		if(sc.nodeType == 3 && this.startOffset > sc.textContent.length) return null;
		if(sc.nodeType == 1 && this.startOffset >= (sc.is ? Polymer.dom(sc) : sc).childNodes.length) return null;

		if(ec.nodeType == 3 && this.endOffset > ec.textContent.length) return null;
		if(ec.nodeType == 1 && this.endOffset >= (ec.is ? Polymer.dom(ec) : ec).childNodes.length) return null;

		// console.log("restore to el: ", sc, " pos: ", this.startPos, this.startOffset);

		r.setStart(sc, this.startOffset);
		r.setEnd(ec, this.endOffset);
		if(doSetCaret)
		{
			setTimeout(function() {
				s.removeAllRanges();
				s.addRange(r);
			});
		}

		return r;
	}

	var UndoItem = function(root, content, prevUndoItem) {
		var m = {};

		this.root = root;
		this.rangeHistory = [];
		this.content = content;

		this.updateRange();

		if(!this.rangeHistory.length && prevUndoItem)
			this.rangeHistory = prevUndoItem.rangeHistory(function(rm) { return rm.clone(); });

		if(!this.rangeHistory.length)
			this.rangeHistory = [ new UndoItem(root) ];
	}

	UndoItem.prototype.updateRange = function() {
		var rm = new RangeMemo(this.root);

		if(!rm)
			return;

		// skip accidential 0 positions when rangeHistory already contains some other location.
		if(this.rangeHistory.length && (rm.startOffset == 0 && !rm.startPos.length || rm.startIsEmpty))
			return;

		if(!this.rangeHistory.length || !rm.isEqual(this.rangeHistory[this.rangeHistory.length - 1]))
			this.rangeHistory.push(rm);

		//console.log("updated range", rm)
	}

	UndoItem.prototype.restore = function(doSetCaret) {
		var i = this.rangeHistory.length - 1, r;

		this.root.innerHTML = this.content;
		Polymer.dom.flush();

		while(i >= 0)
			if(r = this.rangeHistory[i--].restore(doSetCaret))
				return r;
	}

	var getChildPositionInParent = function(child, withDelimiters) {
		var i, cn, p, delimiters = 0;
		if(!child || child == document.body)
			return null;

		p = Polymer.dom(child).parentNode;
		cn = (p.is ? Polymer.dom(p) : p).childNodes;
		for(i=0; cn[i] != child && i < cn.length; i++)
			delimiters += (cn[i] != child && cn[i].isDelimiter) ? 1 : 0;

		//console.log("delimiters:", delimiters)

		return cn[i] == child ? i - (withDelimiters ? 0 : delimiters) : null;
	}

	var getChildPathFromTop = function(child, top) {
		var t, p;

		if(!child || (child == document.body && top != document.body) )
			return null;
		if(child == top)
			return [];

		p = child.parentNode;
		if(Polymer.dom(child).parentNode != p && !isInLightDom(p, top))
			p = Polymer.dom(child).parentNode;

		t = getChildPathFromTop(p, top);
		if(!t)
			return null;
		t.push(getChildPositionInParent(child));
		return t;
	}

	var getChildFromPath = function(pathArr, top)
	{
		var res = top, i = -1, next;

		if(!pathArr)
			return null;

		while(i < pathArr.length)
		{
			i++;
			if(pathArr[i] || pathArr[i] === 0)
				next = (res.is ? Polymer.dom(res) : res).childNodes[pathArr[i]];

			if(!next)
				return res;

			res = next;
		};

		return res;
	}

	var caretPositionFromPoint = function(x, y)
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

		return res.range ? res : null;
	}

	var setCaretAt = function(startTarget, startOffset, endTarget, endOffset) {
		var sel = window.getSelection(),
			range = document.createRange();

		if(!endTarget)
		{
			endTarget = startTarget;
			endOffset = startOffset;
		}

		range.setStart(startTarget, startOffset);
		range.setEnd(endTarget, endOffset);
		range.collapse(startOffset == endOffset);
		sel.removeAllRanges();
		sel.addRange(range);

		return range;
	};

	function nextNode(node, excludeChildren) {
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
	}

	function prevNode(node) {
		var ni;
		if(node.previousSibling)
			return node.previousSibling;
		else
			return node.parentNode;
	}

	function prevNodeDeep(node, top, opts) {
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

	function getSelectionRange() {
		var sel, range;
		if (window.getSelection) {
			sel = window.getSelection();
			if (sel.getRangeAt && sel.rangeCount) {
				range = sel.getRangeAt(0);
			}
		} else if (document.selection && document.selection.createRange) {
			range = document.selection.createRange();
		}

		return range;
	}

	var canHaveChildren = (function() {
		var cache = {};
		return function(node) {
			if(!node || node.nodeType != 1 || !node.tagName)
				return false;

			if(node.is)
				return true;

			if (node && node.canHaveChildren)
				return cache[node.tagName] = node.canHaveChildren();

			return cache[node.tagName] = node.nodeType === 1 && node.ownerDocument.createElement(node.tagName).outerHTML.indexOf("></") > 0;
		}
	})();

	var getFirstCaretPosition = function(node) {
		var n, res;

		if(node.nodeType == 3)
			return { container : node, offset : 0 };

		if(node.childNodes.length)
			while(!res && n < node.childNodes.length)
				res = getFirstCaretPosition(node.childNodes[n]);

		return res;
	};


	var getLastCaretPosition = function(node, offset) {
		var lastContainer, pos;

		if(!node)
			return ni

		if(node.nodeType == 1 && (offset || offset == 0))
			node = Polymer.dom(node).childNodes[offset];

		if(!node || (node.nodeType == 1 && !canHaveChildren(node)))
			if(offset)
				return { container : node, offset : offset }
			else
				return null;

		if(node.nodeType == 1)
		{
			if(Polymer.dom(node).childNodes.length)
			{
				lastContainer = node.childNodes[node.childNodes.length-1];
				while(!(pos = getLastCaretPosition(lastContainer)) && lastContainer.previousSibling)
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
	var splitNode = function(node, offset, limit) {
		var parent = limit.parentNode,
			parentOffset = getChildPositionInParent(limit),
			doc = node.ownerDocument,
			left,
			leftRange = doc.createRange();

		leftRange.setStart(parent, parentOffset);
		leftRange.setEnd(node, offset);
		left = leftRange.extractContents();
		parent.insertBefore(left, limit);

		visitNodes(limit.previousSibling, function(el) {  // hard-reattach custom elements lest they lose their powers
			var h;
			if(el.is)
			{
				h = document.createElement('div'); // other ways don't cause the element to get reinitialized - the whole element must be completely rewritten
				h.innerHTML = recursiveOuterHTML(el);
				el.parentNode.insertBefore(h.firstChild, el);
				el.parentNode.removeChild(el);
			}
		});

		left.normalize();
		limit.normalize();

		return limit;
	}

	var getElementPosition = function(element, fromElement) {
		var top = 0, left = 0, width = 0, height = 0, cs, i;
			fromElement = fromElement || document.body;

		if(!element ||  element.nodeType != 1)
			return null;

		cs = element.getBoundingClientRect(); // getComputedStyle(element);

		width = numerify(cs.width) + numerify(cs.borderLeftWidth) + numerify(cs.borderRightWidth);
		height = numerify(cs.height) + numerify(cs.borderTopWidth) + numerify(cs.borderBottomWidth);

		top += element.offsetTop || 0;
		left += element.offsetLeft || 0;
		element = element.offsetParent;

		while(element && isDescendantOf(element, fromElement))
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

	function isDescendantOf(child, ancestor) {
		var pp;

		while(child && child != document.body)
		{
			pp = Polymer.dom(child).parentNode;
			if(child.parentNode == ancestor || (pp && pp.parentNode == ancestor))
				return true;
			else
				child = (child.parentNode == pp ? child.parentNode : (isInLightDom(child, ancestor) ? pp : Polymer.dom(child).getOwnerRoot().host));
		
		}
		return false;
	}


	// modified code by Tim Down http://stackoverflow.com/questions/6846230/coordinates-of-selected-text-in-browser-page
	// returns {x : x, y : y} of the current coordinates
	var getSelectionCoords = (function () {
		span = document.createElement("span");
		span.appendChild( document.createTextNode("\u200b") );
		span.classList.add('__moignore'); // to be ignored by mutation observer
		// span.setAttribute('contenteditable', false);
		//span.style.width = "3px";
		//span.style.backgroundColor = "pink";

		//span.
		return function _getSelectionCoords(win)
		{
			win = win || window;
			var doc = win.document, offsetParent, oldVal;
			var sel = doc.selection, range, rects, rect;
			var x = 0, y = 0, spanParent;
			if (sel) {
				if (sel.type != "Control") {
					range = sel.createRange();
					range.collapse(true);
					x = range.boundingLeft;
					y = range.boundingTop;
				}
			} else if (win.getSelection) {
				sel = win.getSelection();
				if (sel.rangeCount) {
					range = sel.getRangeAt(0).cloneRange();
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
					// Fall back to inserting a temporary element
					if (x == 0 && y == 0) {
						//var span = doc.createElement("span");
						if (span.getClientRects) {
							//var spanParent = span.parentNode;

							range.insertNode(span);
							//rect = span.getClientRects()[0];
							//x = rect.left;
							//y = rect.top;
							y = span.offsetTop;
							x = span.offsetLeft;

							offsetParent = span;
							while(offsetParent = offsetParent.offsetParent)
							{
								y += offsetParent.offsetTop
								x += offsetParent.offsetLeft
							}

							(spanParent = span.parentNode).removeChild(span);

							// Glue any broken text nodes back together
							spanParent.normalize();

							spanParent.noChange = true;
						}
					}
				}
			}
			//console.log({ x: x, y: y });
			return { x: x, y: y };
		}
	})()

	function caretIsAtContainerEnd() {
		var r = getSelectionRange(),
			maxOffset = (r.startContainer.length || (r.startContainer.childNodes && r.startContainer.childNodes.length))
			i;

		if(r.startOffset >= maxOffset) return true;

		if(r.startContainer.nodeType == 3)
			return /^\s*$/.test(r.startContainer.textContent.substr(r.startOffset, maxOffset));

		return false
	}

	function caretIsAtContainerStart() {
		var r = getSelectionRange(),
			i;

		if(r.startOffset == 0) return true;

		if(r.startContainer.nodeType == 3)
			return /^\s*$/.test(r.startContainer.textContent.substr(0, r.startOffset));

		return false
	}

	function visitNodes(root, visitor, opts, meta) {
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
			visitNodes(el, visitor, opts, meta)
			meta.numericPath.pop(i);
		});
	}

	function isSpecialElement(el) {
		return el && el.is && el;
	}

	function selfOrLeftmostDescendantIsSpecial(el) {
		var n;

		if(!el)
			return el;

		if(isSpecialElement(el))
			return el;

		// skip empty text nodes
		n = el.firstChild;
		while(n && (n.nodeType == 3 && !n.textContent))
			n = n.nextSibling;

		// go recursive
		if(n)
			return selfOrLeftmostDescendantIsSpecial(n);
	}

	function isParagraph(el) {
		return el && el.tagName == 'SPAN' && el.classList.contains('paragraph');
	}

	function isEmptyParagraph(el) {
		return el && el.matchesSelector && el.matchesSelector('span.paragraph') && el.firstChild && el.firstChild.tagName == 'BR';
	}

	function newEmptyParagraph(nobr) { var el; el = document.createElement('span'); if(!nobr) el.appendChild(document.createElement('br')); el.classList.add("paragraph"); return el };

	function wrapInParagraph(el) {
		var el, p = newEmptyParagraph(true);
		el.parentNode.insertBefore(p, el);
		el.parentNode.removeChild(el);
		p.appendChild(el)
		return p;
	};

	function mergeNodes(left, right, setCaretAtMergePoint) {
		var caretPos, ret;

		ret = caretPos = getLastCaretPosition(left);

		if(left.nodeType == 1) // left <-- right
		{

			if(!canHaveChildren(left))
				left = left.parentNode

			if(right.nodeType == 1) // element - element
			{
				while(right.firstChild)
					left.appendChild(right.removeChild(right.firstChild));
				
				right.parentNode.removeChild(right);
			}
			else					// element - text
				left.appendChild(right.parentNode.removeChild(right));

			if(setCaretAtMergePoint)
				setCaretAt(caretPos.container, caretPos.offset);

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
			setCaretAt(caretPos.container, caretPos.offset);

		return ret;
	}


	function dangerousDelete(ev, range) { // cursor is on edge of a light element inside custom component and user clicked delete/backspace which will probably destroy the component
		var tcea, sc, so, scparent, top, np,
			key = ev && (ev.keyCode || ev.which);

		if(!ev || ev.type != 'keydown' || !(key == 8 || key == 46))
			return;

		if(range.startContainer != range.endContainer || range.startOffset != range.endOffset)
			return;

		sc = range.startContainer;
		scparent = sc.parentNode
		so = range.startOffset;
		top = this.$.editor;

		tcea = getTopCustomElementAncestor(sc, top);

		//if(!tcea) // || isInLightDom(scparent, top)) // not in custom element or is child of another parent within light dom
		//	return;

		if  (tcea && (
				(key == 8 && so == 0) // bakspace @ start of a dangerous container
			||
				(
					key == 46 &&
					(
						(sc.nodeType == 3 && so >= sc.length  && !sc.nextSibling) ||
						(sc.nodeType != 3 && so >= sc.childNodes.length - 1) // delete @ end of a dangerous container
					)
				)
			))
			ev.preventDefault(); // preventDefault returns undefined

		np = this.getElementAfterCaret({skip : 'br'});
		if(key == 46 && np && np.nodeType == 1 && np.is)
			ev.preventDefault();

		np = this.getElementBeforeCaret({ atomicCustomElements : true });
		if(key == 8 && np && np.nodeType == 1 && np.is)
			ev.preventDefault();
	}


	var numerify = function (x){
		if(typeof x == 'undefined' || !x)
			return 0;

		if(typeof x == 'number')
			return x;

		return Number(x.replace ? x.replace(/[^\d\.]/g, '') : x);
	};

})();

