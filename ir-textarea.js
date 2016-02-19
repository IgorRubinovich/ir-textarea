(function () {

  var INLINE_ELEMENTS = {};
  "b,big,i,small,tt,abbr,acronym,cite,code,dfn,em,kbd,strong,samp,time,var,a,bdo,br,img,map,object,q,script,span,sub,sup".split(/,/)
    .forEach(function(tag) { INLINE_ELEMENTS[tag.toUpperCase()] = true });

  Polymer({
		is : 'ir-textarea',
		ready : function() {
		  var that = this,
			commands = this.commands.split(/,/),
			newButton, cmdDef, icon, ev, handler, altTarget, moveOccured, selectionTracker;

			this.skipNodes = [];
			this.__actionData = {};

			handler = function(ev) {
				that.selectionSave();

				var el, toDelete, keyCode = ev.keyCode || ev.which, t, forcedelete, r, done, localRoot, last, n, nn, pn, pos, firstRange, merge;

				// save position on control keys
				// console.log(ev.which || ev.keyCode);
				if(((ev.type == 'keyup' || ev.type == 'keydown') && ([33,34,35,36,37,38,39,40].indexOf(keyCode) > -1)) || (ev.type == 'mousedown' || ev.type == 'mouseup'))
					that.customUndo.pushUndo(false, true);

				if(ev.type == 'keyup' || ev.type == 'keydown')
					that.fire('scroll-into-view', getSelectionCoords());

				
				if (ev.type == 'keydown' && keyCode == 13) { 	// line break
					r = that.selectionRestore();
					if(ev.shiftKey || 
						getTopCustomElementAncestor(r.startContainer, that.$.editor) || 
						that.selectAncestor(r.startContainer, 'table', that.$.editor) ||  // need more work to enable paragraphs in tables
						getTopCustomElementAncestor(r.endContainer, that.$.editor))
					{
							r = getSelectionRange();
							if(r.startContainer.nodeType == 3 && (r.startContainer.length - 1 <= r.startOffset && r.startContainer.textContent.charAt(r.startOffset).match(/^ ?$/) && nextNode(r.startContainer).tagName != "BR"))
								firstRange = that.pasteHtmlAtCaret('<br>', false, true);
								
							that.pasteHtmlAtCaret('<br>', false, true);

							//if(r.startContainer.nodeType == 3 && r.startContainer.length == r.startOffset)
							//	that.pasteHtmlAtCaret('<br>', false);
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

							if(n = nextNode(r.startContainer.childNodes[pos]) && n.is)
									setCaretAt(r.startContainer, r.startOffset - 1);
					}
					else														// new paragraph
						that.pasteHtmlWithParagraphs('<span class="paragraph"><br></span>', true);

					that.ensureCursorLocationIsValid({reverseDirection : true});
					
					that.frameContent();
					that._updateValue();
					that.selectionSave();
					ev.preventDefault();
					return;
				}
				
				if(ev.type == 'keydown' && (keyCode == 8 || keyCode == 46)) // deletes
				{
					that.ensureCursorLocationIsValid({originalEvent : ev});
					
					if(ev.defaultPrevented && (tcea = getTopCustomElementAncestor(el, that.$.editor)) && tcea != el)
						;
					else
					if(that.__actionData.target)
					{
						toDelete = that.__actionData.target;
						forcedelete = true; //ev.preventDefault();
					}
					else
					if(keyCode == 46 && (el = that.getElementAfterCaret({skip : 'br'}))) // del key
					{
						r = getSelectionRange();
						
						nn = caretIsAtContainerEnd() && nextNode(el);
						
						if((toDelete = isSpecialElement(el)) || (toDelete = isSpecialElement(el.firstChild)) || 
							(el.firstChild && el.firstChild.nodeType == 3 && !el.firstChild.textContent && (toDelete = isSpecialElement(el.firstChild.nextSibling))) || 
								(nn && (toDelete = isSpecialElement(nn)) || (toDelete = isSpecialElement(nn.firstChild))))
						{
							forcedelete = true;  //ev.preventDefault();
							// toDelete = el;
						}

						while(!toDelete && el && el.nodeType == 1 && el.firstChild && el.firstChild.nodeType == 1)
						{
							el = el.childNodes[0];
							if(isSpecialElement(el) || (getTopCustomElementAncestor(el, that.$.editor) && !isInLightDom(el, this.$editor)))
							{
								toDelete = el;
								forcedelete = true;  //ev.preventDefault()
							}
						}
					}
					else
					if(keyCode == 8 && (el = that.getElementBeforeCaret({ atomicCustomElements : true}))) // backspace key
					{
						//t = el.childNodes[el.childNodes.length - 1];
						
						//if(!isSpecialElement(el) && caretIsAtContainerStart())
						//	el = prevNodeDeep(el, that.$.editor, { atomicCustomElements : true });
						
						if(isSpecialElement(el))
						{
							
							toDelete = el;								
							forcedelete = true;  //ev.preventDefault()
							
						}
					}

					if(toDelete && toDelete.parentNode && toDelete.nodeType == 1 && (forcedelete || !ev.defaultPrevented)) //(ev.defaultPrevented) // should be prevented by ensureCursorLocationIsValid
					{
						if(toDelete.parentNode.firstChild == toDelete && toDelete.parentNode.lastChild == toDelete)
						{
							toDelete = toDelete.parentNode;
						}
						
						if(toDelete.previousSibling && toDelete.nextSibling)
							merge = { left : toDelete.previousSibling, right : toDelete.nextSibling };
						else
						if(!toDelete.nextSibling && toDelete.parentNode != that.$.editor && toDelete.parentNode.nextSibling)
							merge = { left : toDelete.parentNode, right : toDelete.parentNode.nextSibling };
						else
						if(!toDelete.previousSibling && toDelete.parentNode != that.$.editor && toDelete.parentNode.previousSibling)
							merge = { left : toDelete.parentNode.previousSibling, right : toDelete.parentNode };

						that.deleteTarget(toDelete);

						if(merge)
							mergeNodes(merge.left, merge.right, true);

						ev.preventDefault();

						that.customUndo.pushUndo();
					}
				}
				
				altTarget = getTopCustomElementAncestor(ev.target, that.$.editor) || (ev.target.proxyTarget && ev.target);
				if(ev.type == 'mousedown' && altTarget && that.__actionData.type != 'drag' &&
					!(ev.target.childNodes.length == 1 && ev.target.childNodes[0].nodeType == 3) && !(isInLightDom(ev.target) && ev.target.nodeType == 3))
				{
					//console.log(ev.target);
					that.moveTarget.call(that, altTarget);
					ev.preventDefault();
				}

				if(ev.type != 'mousedown')
					that.ensureCursorLocationIsValid({reverseDirection : [8,33,37,38].indexOf(keyCode) > -1, originalEvent : ev}); // left, up, pgup
				
				// console.log(ev.type);
				if(ev.type == 'drop' && ev.target && (getTopCustomElementAncestor(ev.target, that.$.editor) || ev.target.proxyTarget)) // prevent default drop (like text) into custom elements - it breaks them
					ev.preventDefault();
					
				that._updateValue();
				that.selectionSave();
				
				console.log('default prevented: ', ev.defaultPrevented);
			};


			"mousedown,mouseup,keydown,keyup,drop".split(',')
				.forEach(function(evType)
				{
					that.$.editor.addEventListener(evType, handler);
				});
				
			selectionTracker = function(ev) {
					that.selectionSave();
					window.removeEventListener('mouseup', selectionTracker);
				}

			that.$.editor.addEventListener('mousedown', function(ev) {
				window.addEventListener('mouseup', selectionTracker);
			});

			this.domProxyManager = ir.DomProxyManager.getProxyManager( // last argument maps selector->transformation for cases when target is not the dimensions source
										':not(.embed-aspect-ratio)>iframe,.embed-aspect-ratio',
										{ rootNode : this.$.editor, createRootNode : this.$.editor, fromElement : this.$.editor },
										{ '.embed-aspect-ratio' : function(el) { return el.childNodes[0]; } }
									);

			this.$.editor.addEventListener('click', this.contextMenuShow.bind(this), true); // capturing phase

			var pasteHandler = function(e) {
				var v, d, withParagraphs, i, n, nn;
				if(typeof clipboardData != 'undefined')
					v = clipboardData.getData();
				else
					v = e.originalEvent ? e.originalEvent.clipboardData.getData('text/html') : ((e.clipboardData.getData('text/html') || '<span class="paragraph">' + e.clipboardData.getData('text/plain').replace(/\n/, '</span><span class="paragraph">') + "</span>"));
				
				if(!v)
					return;

				if(v.match(/<!--StartFragment-->/i))
				{
					v = v	.replace(/<!--\[if[^\[]*\[endif\]--\>/gi).replace(/\<style[\s][\S]+<\/style>/ig, '')
							.replace(/<(meta|link)[^>]>/, '')
							.match(/<!--StartFragment-->([\s\S]*?)(?=<!--EndFragment-->)/i)[1]
				}

				if(v)
					v = v.replace(/\<\/?o\:[^>]*\>/g, '')
						 .replace(/<p([\s\S]*?(?=<\/p>))<\/p>/gi, '<span class="paragraph" $1</span>')
						 .replace(/\n/g, '')
						 .replace(/<span[^>]*>\s*<\/span>/g, '')
						 .replace("&nbsp;", " ");
				
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
				
				// if it's a single paragraph only use text
				// if(d.childNodes.length == 1 && d.firstChild == 
				
				if(d.textContent)
					that.pasteHtmlWithParagraphs(d.innerHTML, { removeFormat : false });
				
				/*if(d.childNodes.length > 1)
					withParagraphs = v = d.innerHTML;
				else
					v = d.childNodes[0].innerHTML;*/
				//}
				//else
				//	that.pasteHtmlAtCaret(v);
				
				e.preventDefault();
				return false;
			};

			console.log('setting up paste handler...');
			that.$.editor.addEventListener('paste', pasteHandler);
			// that.$.editor.addEventListener('copy', pasteHandler);

			var defs = {};
			window.ir.textarea.commands
				.forEach(function(cmdDef) {
					if(commands.indexOf(cmdDef.cmd) > -1)
						defs[cmdDef.cmd] = cmdDef;
				});

			// get them in order
			this.toolbarButtons = commands.map(function(c) { return c ? defs[c] : ""; });

			this.$.htmlTextArea.addEventListener("change", function () {
				if(that.$.htmlTextArea.value == that.value)
					return;

				that.$.editor.innerHTML = that.value = that.$.htmlTextArea.value;
				//that.cleanHTML();
			});

			this.$.mediaEditor.editor = this.$.editor;

			this.set('customUndo', CustomUndoEngine(this.$.editor, {
																		getValue : this.getCleanValue.bind(this),
																		contentFrame : '<span class="paragraph"><br></span>[content]<span class="paragraph"><br></span>',
																		timeout : false,
																		onRestoreState : function(el) {
																			this.selectionSave()
																			this.ensureCursorLocationIsValid();
																			//this.fire('scroll-into-view', el);
																		}.bind(this)
																	}))
		},

		attached: function(){
			this.insertPlugins();
			setTimeout(function() { this._updateValue(); }.bind(this), 300);

			var that = this, cleanval;

			var tbar = {};
			tbar.toolbarOffsetTop = this.offsetTop;
			tbar.toolbarOffsetHeight = this.offsetHeight;
			tbar.toolbarOffsetWidth = this.offsetWidth;

			tbar.setPosition = function(x){
				if(tbar.scrollTop > tbar.toolbarOffsetTop && (that.clientHeight + tbar.toolbarOffsetTop - tbar.toolbarOffsetHeight) > tbar.scrollTop){
					that.set("toolbarfix",'fixit');
					if(tbar.headerState == 0){
						that.set("toolbarstyle",'top:'+tbar.headerHeight+'px');
					}
					else if(tbar.headerState == 2){
						that.set("toolbarstyle",'top:'+tbar.condensedHeaderHeight+'px');
					}
					else if(tbar.headerState == 3){
						that.set("toolbarstyle",'top:'+ (tbar.headerHeight) +'px');
					}
				}
				else{
					that.set("toolbarfix",'nofix');
					that.set("toolbarstyle",'top:0');
				}
			};

			mediator.subscribe('scrolling', function( arg ){
				tbar.scrollTop = arg.scrollTop;
				tbar.headerState = arg.headerState;
				tbar.condensedHeaderHeight = arg.condensedHeaderHeight;
				tbar.headerHeight = arg.headerHeight;
				tbar.transformOffset = arg.transformOffset;;
				tbar.setPosition();

				that.skipNodes = that.domProxyManager.createProxies();
			});
			
			Object.keys(this.promptProcessors).forEach(function(pp) { 
				var el = document.getElementById(this.promptProcessors[pp]);
				if(!el._hasOverlayClosedListener)
					el.addEventListener('iron-overlay-closed', function() { this.selectionRestore(); }.bind(this)); 

				el._hasOverlayClosedListener = true;
			}.bind(this));			


			that.domProxyManager.createProxies()
			
			
			this._initialValue = this.$.editor.innerHTML = this.getCleanValue();

			this._updateValue();
		},

		contextMenuShow : function(ev) {
			var cm = this.$.contextMenu, target = ev.target, flowTarget, captionWrapper,
				mediaEditor = this.$.mediaEditor, that = this, altTarget = ev.target, candidateTarget, parentCustomEl,
				actionTarget = target,
				menuGroups = {
						resizeable : "video,img,iframe,.embed-aspect-ratio",
						floatable : "video,img,iframe,.embed-aspect-ratio",
						removeable : "video,img,table,iframe,.embed-aspect-ratio"
				},
				actionableTags = [menuGroups.resizeable, menuGroups.floatable, menuGroups.removeable].join(",");

			cm.disabled = true;

			target = actionTarget = getClosestLightDomTarget(target, this.$.editor);

			parentCustomEl = getTopCustomElementAncestor(target, this.$.editor);
			if(parentCustomEl)
			{
				ev.stopPropagation();
				ev.stopImmediatePropagation();
			}

			if(this.__actionData.target != target)
				this.clearActionData();

			// check whether target is...
			if(!target || target == this.$.editor || // interesting
				!(target.proxyTarget || target.is || target.matchesSelector(actionableTags))) // and actionable
			{
				this.__actionData.showMenuFor = null;
				this.clearActionData();
				return;
			}

			if(target && target.matchesSelector('.embed-aspect-ratio'))
				actionTarget = target.childNodes[0];

			// select target for action
			if(!this.__actionData.target)
				this.selectForAction(actionTarget || target);

			// if target is resizable and wasn't set up do set it up for resize
			if(target.matchesSelector(menuGroups.resizeable) ||
				(target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.resizeable))
				&& (this.__actionData.resizableTarget != target))
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

					if(param.target && param.target.proxyTarget)
						param.target = param.target.proxyTarget;
					else
					if(param.proxyTarget)
						param = param.proxyTarget;

					if(f)
						f.call(that, param);

					that.clearActionData();
					that._updateValue();
				}
			};

			cm.options = [];

			cm.options.push({label: '',  icon: 'icons:cancel', info: '', value : target, action : imageAction(null)});

			if(target.matchesSelector(menuGroups.resizeable) || (target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.resizeable)))
				cm.options.push({label: 'Resize', icon: 'icons:size', info: '', value : target, action : this.resizeTarget.bind(this)});

			cm.options.push({label: 'Remove media',  icon: 'icons:align', info: '', value : target, action : imageAction(this.deleteTarget.bind(this))});

			flowTarget = target;

			// target.is || target.matchesSelector(menuGroups.floatable) || (target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.floatable))
			// can only float:
			if((target.is == 'ir-gallery' && Polymer.dom(target).querySelectorAll('img').length == 1) ||    // single-image gallery for now
			(target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.floatable)) ||		    // proxied elements (iframes)
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

		  this.__actionData._border = t.style.border;
		  this.__actionData._display = t.style.display;
		  t.style.border = "3px dashed grey";
		  t.style.display = "inline-block";
		},

		removeActionBorder : function() {
		  if(!this.__actionData.target)
			return;

		  this.__actionData.target.style.border = this.__actionData._border || "none";
		  this.__actionData.target.style.display = this.__actionData._display || "";
		},

		selectForAction : function(target, type) {
		  var ad = this.__actionData;

		  if(this.__actionData.target == target || target.nodeType != 1)
			return;

		  this.clearActionData();

		  this.__actionData.target = target;
		  this.__actionData.type = type;

		  target = getTopCustomElementAncestor(target, this.$.editor);

		  moveCaretAfterOrWrap(target, null, this.$.editor);

		  this.addActionBorder();
		},

		clearActionData : function() {
		  var ad = this.__actionData

		  this.removeActionBorder();

		  ad.target = ad.lastAction = ad.type = null
		},

		deleteCmd : function() {
			if(this.__actionData && this.__actionData.target)
				this.deleteTarget(this.__actionData.target);
			else
				this.execCommand('delete');
		},

		deleteTarget : function(target) {
			var deleteTarget, p, pce, cover;
			
			if(target.proxyTarget)
				target = target.proxyTarget;

			cover = this.skipNodes.filter(function(n) { return n.proxyTarget == target })[0];

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

			p = deleteTarget.parentNode; // delete target is a top parent custom element, meaning its parent is surely no in another custom element's dom

			if(!p)
				return;

			if(p.is)
				p = Polymer.dom(p);

			p.removeChild(deleteTarget);
			this._updateValue();
			
			if(cover)
				this.skipNodes = this.domProxyManager.createProxies()

		  //Polymer.dom(target).removeChild(target);
		  //this._updateValue();
		},

		resizeTargetStop : function(ev) {
		  if(!(ev === true || ev.target != this.__actionData.resizeTarget))
			return;

		  var interactable = this.__actionData.interactable,
			target = this.__actionData.resizeTarget;

		  if(interactable)
			interactable.unset();

		  this.clearActionData();

		  document.removeEventListener('mouseup', this.resizeTargetStop);
		  document.removeEventListener('click', this.resizeTargetStop);
		},

		resizeTarget : function(target) {
		  var that = this, resizeHandler;

		  if(this.__actionData.resizableTarget)
			this.resizeTargetStop(true);

		  that.__actionData.resizeTarget = target;

		  document.addEventListener('mouseup', this.resizeTargetStop.bind(this));
		  document.addEventListener('click', this.resizeTargetStop.bind(this));

		  var interactable = interact(target)
			.resizable({
			  edges: { left: true, right: true, bottom: true, top: true }
			})
			.on('resizemove', resizeHandler = function (event) {
			  var target = event.target,
				computedStyle = target.getBoundingClientRect(),

				x = (parseFloat(target.getAttribute('data-x')) || 0),
				y = (parseFloat(target.getAttribute('data-y')) || 0),

				sw = Number(target.style.width.replace(/px/, '') || 0) || computedStyle.width,
				sh = Number(target.style.height.replace(/px/, '') || 0) || computedStyle.height,
				ratio, w, h;

			  ratio = sh/sw;
			  w = event.rect.width;
			  h = ratio * w;

			  // update the element's style
			  target.style.width  = w + 'px';
			  target.style.height = h + 'px';
			  target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px,' + y + 'px)';

			  if(target.tagName == 'IFRAME')
			  {
				target.setAttribute("width", w + 'px');
				target.setAttribute("height", h + 'px');
			  }


			  that.__actionData.dragTarget = null; // resize takes over drag
			  // translate when resizing from top or left edges
			  //x += event.deltaRect.left; //y += event.deltaRect.top;
			})
			.on('resizeend', function() {
			  var t, st, numW, numH;

			  if(t = st = that.__actionData.resizeTarget)
			  {
				if(t.proxyTarget)
				{
				  if(t.proxyTarget.matchesSelector('.embed-aspect-ratio'))
				  {
					t.proxyTarget.style.width = t.style.width;
					
					numW = Number(t.style.width.replace(/px/, ''));
					numH = Number(t.style.height.replace(/px/,''));
					
					t.proxyTarget.style.paddingBottom = numH + "px"; //100*(numH / numW) + "%";
					if(t.proxyTarget.firstChild && t.proxyTarget.firstChild.tagName == 'IFRAME')
					{
						t.proxyTarget.firstChild.setAttribute('width', numW);
						t.proxyTarget.firstChild.setAttribute('height', numH);
					}
					//t.proxyTarget.style.height = t.style.height;
					st = t.proxyTarget.childNodes[0];
				  }
				  else
				  if(t.proxyTarget.matchesSelector('iframe'))
					st = t.proxyTarget

				  st.style.width = t.style.width
				  st.style.height = t.style.height
				  st.style.webkitTransform = st.style.transform = t.style.transform;
				}

				if(that.__actionData.resizePosition)
				  t.style.position = that.__actionData.resizePosition;

				//that.clearActionData();
				that.__actionData.lastAction = "resize";
			  }
			});

		  if(!target.style.position || target.style.position == 'static')
		  {
			this.__actionData.resizePosition = target.style.position;
			target.style.position = "relative";
		  }

		  this.__actionData.interactable = interactable;
		},

		moveTarget : function(target, done) {
		  var html, actualTarget, handler, caretPosData, moveOccured, tpce;

		  if(this.__actionData.dragTarget && !done)
			return;

		  // calculate drop target and move drag target there
		  if(done)
		  {
			actualTarget = this.__actionData.dragTarget.proxyTarget || this.__actionData.dragTarget;
			caretPosData = this.__actionData.caretPosData;

			if(caretPosData && caretPosData.node)
			  caretPosData.node = (tpce = getTopCustomElementAncestor(caretPosData.node, editor)) || caretPosData.node;

			if(actualTarget.parentNode && (caretPosData && this.isOrIsAncestorOf(this.$.editor, caretPosData.node)) && !this.isOrIsAncestorOf(actualTarget, caretPosData.node))
			{
			  this.clearActionData();
			  this.__actionData.caretPosData = null;

			  html = recursiveOuterHTML(actualTarget, this.skipNodes);

			  // for now, forbid explicitly to drop into custom elements. (for custom targets only - built-in text drop is still possible! - e.g., it's ok to move text into a caption inside a gallery)
			  if(tpce)
				moveCaretAfterOrWrap(tpce, null, this.$.editor);
			  else
			  if(caretPosData.node.proxyTarget)
				moveCaretAfterOrWrap(caretPosData.node.proxyTarget, null, this.$.editor);

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

		  if(n.nodeType == 1 && n.childNodes.length)
		  {
			n = n.childNodes[o] || n;
			o = getChildPositionInParent(n);
		  }

		  if(n.nodeType == 3 && o < n.length)
			return n;

		  n = nextNode(n);
		  while(!done)
			for(i = 0; !done && i < opts.skip.length; i++)
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
		  opts.atomic = ['.embed-aspect-ratio'];

		  if(!r || (!r.startOffset && r.startOffset != 0)  || r.startOffset != r.endOffset)
			return null;

		  if(r.startContainer.nodeType == 1)
			return prevNodeDeep(r.startContainer.childNodes[r.startOffset] || r.startContainer, this.$.editor, opts);
		  else
		  if(!r.startOffset)
			return prevNodeDeep(r.startContainer, this.$.editor, opts);

		  return r.startContainer;
		},

		pasteHtmlWithParagraphs : function (html, opts)
		{
			var div, paragraph, r, caretAt = {}, firstIsEmptyParagraph, container, newWrapperParagraph, container, firstToWrap, index, isNewParagraph, lastInserted, pos, first, last;
			
			div = document.createElement('div');
			div.innerHTML = html;

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
				r.deleteContents();

			r = getSelectionRange();

			first = r.startContainer;
			firstOffset = r.startOffset;
			if(first.nodeType == 1)
			{
				first = first.childNodes[firstOffset];
				firstOffset = 0;
			}
			
			firstIsEmptyParagraph = isEmptyParagraph(first);
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
				while(!isParagraph(firstToWrap.previousSibling) && (firstToWrap.previousSibling && (firstToWrap.previousSibling.nodeType == 3 || INLINE_ELEMENTS[firstToWrap.previousSibling.tagName])))
					firstToWrap = firstToWrap.previousSibling;
				
				container = firstToWrap.parentNode;
				index = getChildPositionInParent(firstToWrap);
							
				while(!isParagraph(firstToWrap) && (firstToWrap && (firstToWrap.nodeType == 3 || INLINE_ELEMENTS[firstToWrap.tagName])))
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
			
			// set caretAt

			container = first;
			// find first praragraph or non-text, non-inline container. it could have been the editor but we wrapped bare nodes earlier
			while(!isParagraph(container) && (container.nodeType == 3 || INLINE_ELEMENTS[container.tagName]))
				container = container.parentNode;
			
			if(caretAt.containerStart || (container.firstChild == first && firstOffset == 0))
				caretAt.containerStart = true;
			else
			{
				pos = getLastCaretPosition(container);
				if(pos.container == first && pos.offset == firstOffset)
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
					setCaretAt(pos.container, pos.offset);
					if(!container.textContent)
						container.parentNode.removeChild(container);
				}
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
			else
			{
				last = splitNode(first, firstOffset, container);
				
				// after the split first will actually sit inside last.
				if(!first.textContent)
				{
					first = first.nextSibling;
					first.parentNode.removeChild(first.previousSibling);
				}
				
				if(!isNewParagraph || (selfOrLeftmostDescendantIsSpecial(first)))
				{
					while(div.firstChild)
						lastInserted = container.parentNode.insertBefore(div.firstChild, last);

					pos = getLastCaretPosition(lastInserted);
					return setCaretAt(pos.container, pos.offset);
				}
				return setCaretAt(last, 0);
			}
		},
		
		pasteHtmlAtCaret : function(html, removeFormat, keepLastBr) {
			var sel, range, endNode, newRange, node, lastNode, preLastNode, el, frag, pos, isLastInEditor, target, pos, offset;

			if (window.getSelection) {
				// IE9 and non-IE
				sel = window.getSelection();
				if (sel.getRangeAt && sel.rangeCount) {
					range = sel.getRangeAt(0);
					range.deleteContents();

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

					if(range.startContainer.nodeType == 1 && 
						(range.startOffset >= range.startContainer.childNodes.length) && 
						range.startContainer.childNodes[range.startOffset-1] && 
						range.startContainer.childNodes[range.startOffset-1].tagName == 'BR')
						
						range = setCaretAt(range.startContainer, range.startOffset-1)
						
					range.insertNode(frag);
					
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
							lastNode.parentNode.appendChild(target = newEmptyParagraph());
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

			rangeSelectElement : function(node)
		{
			var sel = document.getSelection();
			var range = document.createRange();
			this.$.editor.focus();
			range.setStartBefore(node);
			range.setEndAfter(node);
			sel.removeAllRanges();
			sel.addRange(range);
		},

		// to use instead of execCommand('insertHTML') - modified from code by Tim Down
		insertHTMLCmd : function (html) {
			//this.selectionRestore();
			
			var ef = html.match(/\<p[^\>]+\>/) ? ["p"] : [];
			//var ef = html.match(/\<div[^\>]+\>/) ? ["p", "div"] : [];
			
			//this.async(function() {
				var r, after;
				
				this.ensureCursorLocationIsValid({ extraForbiddenElements : ef });
				r = this.pasteHtmlAtCaret(html);
				
				//setCaretAt(r.endContainer, r.endOffset);

				if(r.endContainer.nodeType == 1)
					after = r.endContainer[r.endOffset]
				else
					after = r.endContainer;
				
				// moveCaretAfterOrWrap(after, after, this.$.editor);
				
				this.ensureCursorLocationIsValid();
				this._updateValue()
			//});
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
        if(this.isCommandPossible(cmd, sdu, val)){
          document.execCommand(cmd, sdu, val);
          this.selectionSave();
          setTimeout(function(){
            that.selectionRestore();
          }, 200);



        }

      }

      // this.selectionRestore();
      /*
       if(cmd == 'cut' || cmd == 'copy'){
       this.text = this.getSelectionHtml();
       document.execCommand(cmd, sdu, val);
       }

			else*/
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
			//console.log("selection: ", this._selectionRange.toString());
		},

		selectionRestore : function (noForceSelection) {
			var range, sel, sc, ec;

			range = getSelectionRange();
			
			if(range && this.isOrIsAncestorOf(this.$.editor, range.startContainer))
				return range;
			
			range = this._selectionRange
			
			if(range) {
				sc = range.startContainer;
				ec = range.endContainer;
			}

			this.$.editor.focus();
			
			if (range && sc && ec && this.isOrIsAncestorOf(this.$.editor, sc) && this.isOrIsAncestorOf(this.$.editor, ec)) {
				if (window.getSelection) {
					sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (document.selection && range.select) {
					range.select();
				}
			}
			else
			if(!noForceSelection)
			{
				// if no selection, go to offset 0 of first child, creating one if needed
				if(!this.$.editor.childNodes.length)
					this.$.editor.appendChild(document.createTextNode());

				range = document.createRange();

				range.setStartBefore(this.$.editor.childNodes[0], 0);
				range.setEndBefore(this.$.editor.childNodes[0], 0);

				range.collapse(true);

				sel = window.getSelection();
				this.$.editor.focus();

				sel.removeAllRanges();
				sel.addRange(range);
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
			},
			function inLightDom(opts, range) {
				return ensureCaretIsInLightDom(this.$.editor, opts.reverseDirection)
			},
			function notInProxy(opts, range) {
				var sni = range.startContainer.proxyTarget,
					eni = range.endContainer.proxyTarget;
					
				if(sni = sni || eni ) {
					if(opts.originalEvent.type == 'mouseup' || opts.originalEvent.type == 'drop')
						opts.reverseDirection ? 
							moveCaretBeforeOrWrap(sni, sni, this.$.editor) :
							moveCaretAfterOrWrap(sni, sni, this.$.editor); 
					else // otherwise we reached there by keyboard and should be thrown back
						moveCaretBeforeOrWrap(range.startContainer, range.startContainer, this.$.editor); // no need for moveCaretAfterOrWrap(sc) as proxy nodes should be sitting at the very end

					return true;
				}
			},
			
			/*function isTextNode(opts, range) {
				var sc = range.startContainer, ec = range.endContainer;
				
				if(!sc.matchesSelector || !ec.matchesSelector)
					console.log('in a text node - so what?');
				
				//if(!sc.matchesSelector) sc = getClosestLightDomTarget(sc.parentNode, this.$.editor);
				//if(!ec.matchesSelector) ec = getClosestLightDomTarget(ec.parentNode, this.$.editor);
			},*/
			
			function isInForbiddenElement(opts, range) {
				var sni, eni, 
					sc = range.startContainer,
					ec = range.endContainer,
					so = range.startOffset,
					eo = range.endOffset,
					forbiddenElements, fe, scat, ecat;

				forbiddenElements = ".caption-wrapper,.embed-aspect-ratio,iframe".split(',').concat(opts.extraForbiddenElements);

				scat = sc;
				if(sc.nodeType == 3)
					scat = sc.parentNode;
				else
				if(sc.childNodes[so] && sc.childNodes[so].nodeType == 1)
					scat = sc.childNodes[so];
				
				ecat = ec;
				if(ec.nodeType == 3)
					ecat = ec.parentNode;
				else
				if(ec.childNodes[eo] && ec.childNodes[eo].nodeType == 1)
					ecat = ec.childNodes[eo];
				
				for(i = 0; i < forbiddenElements.length && !sni && !eni; i++)
				{
					fe = forbiddenElements[i];
					sni = scat.matchesSelector(fe) || (sc.matchesSelector && sc.matchesSelector(fe));
					eni = ecat.matchesSelector(fe) || (ec.matchesSelector && ec.matchesSelector(fe));
				}

				if(sni || eni)
					opts.reverseDirection ? moveCaretBeforeOrWrap(scat, null, this.$.editor) : moveCaretAfterOrWrap(scat, null, this.$.editor);
				
				return sni || eni;
			},
			
			function isInCustomElement(opts, range) {
				var sni, eni, sc = range.startContainer, ec = range.endContainer, so = range.startOffset, eo = range.endOffset;
				
				sni = sc.is || (sc.nodeType == 1 && sc.childNodes[so] && sc.childNodes[so].is); // || so > 1 && (sc.nodeType != 3) && sc.childNodes[so-1] && sc.childNodes[so-1].is;
				eni = ec.is || (ec.nodeType == 1 && ec.childNodes[eo] && ec.childNodes[eo].is);
							
				if(sni || eni)
					opts.reverseDirection ? moveCaretBeforeOrWrap(sc, null, this.$.editor) : moveCaretAfterOrWrap(sc, null, this.$.editor);
								
				return sni || eni;
			},
			
			function dangerousDelete(opts, range) { // cursor is on edge of a light element inside custom component and user clicked delete/backspace which will probably destroy the component
				var ev = opts.originalEvent, tcea, sc, so, scparent, top, np, 
					key = ev && (ev.keyCode || ev.which);
				
				if(!opts.originalEvent || opts.originalEvent.type != 'keydown' || !(key == 8 || key == 46))
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
								(sc.nodeType == 3 && so >= sc.length) ||
								(sc.nodeType != 3 && so >= sc.childNodes.length - 1) // delete @ end of a dangerous container
							)
						)
					))
					opts.originalEvent.preventDefault(); // preventDefault returns undefined
					
				np = this.getElementAfterCaret({skip : 'br'});
				if(key == 46 && np && np.nodeType == 1 && (np.is || np.matchesSelector('.embed-aspect-ratio')))
					opts.originalEvent.preventDefault();
				
				np = this.getElementBeforeCaret({ atomicCustomElements : true });
				if(key == 8 && np && np.nodeType == 1 && (np.is || np.matchesSelector('.embed-aspect-ratio')))
					opts.originalEvent.preventDefault();				
			},
			
			function leftAtStartOfTextNode(opts, range) {
				var key, tc, to, doset;
				
				if(!opts.originalEvent || opts.originalEvent.type != 'keydown' || range.startContainer.nodeType != 3)
					return;
				
				key = opts.originalEvent.keyCode || opts.originalEvent.which;
				
				if(key == 37 && range.startOffset == 1) // left
				{
					tc = range.startContainer.parentNode;
					to = getChildPositionInParent(range.startContainer);
					doset = true;
				}
				
				if(!doset)
					return;
				
				setCaretAt(tc, to);
				opts.originalEvent.preventDefault();
			
				return true;
			}

		],
		
		ensureCursorLocationIsValid : function(opts) { // if reverseDirection is true cursor is moving in reverse to typing direction
			var r, i, sp, sc, ec, so, eo, totalChecks = 0, jumpsOccured = 0;
			
			opts = opts || {};

			opts.extraForbiddenElements = opts.extraForbiddenElements || [];

			for(i = 0; i < this.cursorRules.length && totalChecks++ < 50; i++)
				if(this.cursorRules[i].call(this, opts, r = getSelectionRange()))
				{
					// console.log('was ' + this.cursorRules[i].name, " now in ", r.startContainer);
					i = -1;
					jumpsOccured++;
				}

			if(totalChecks >= 50)
				console.log('too many cursor movements');

			// now we can be sure the cursor is in editor and in light dom relative to the editor
			r = getSelectionRange();
			sc = r.startContainer;
			ec = r.endContainer;			
			so = r.startOffset;
			eo = r.endOffset;

			// if navigation occured, scroll view to bing the cursor into view
			//if(!opts.originalEvent || [38, 40, 37, 39, 8].indexOf(opts.originalEvent.keyCode || opts.originalEvent.which) > -1)
			this.fire('scroll-into-view', getSelectionCoords());
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
			var ed = this.$.editor, nn, i, d, lastBeforeSkip;

				// is a <span><br></span>
				/*isFramingEl = function(d) { return 	d.tagName &&
													d.tagName == 'SPAN' &&
													d.childNodes.length == 1 &&
													d.childNodes[0].tagName &&
													d.childNodes[0].tagName == 'BR'; },*/
				// a new <p><br></p>
				

			if(!ed.childNodes.length)
				return ed.appendChild(newEmptyParagraph());

			if(!isEmptyParagraph(ed.childNodes[0]))
			{
				if(ed.childNodes[0] && ed.childNodes[0].matchesSelector && ed.childNodes[0].matchesSelector('span.paragraph') && !ed.childNodes[0].innerHTML)
					ed.childNodes[0].innerHTML = '<br>'
				else
					ed.insertBefore(newEmptyParagraph(), ed.childNodes[0]);
			}

			lastBeforeSkip = ed.lastChild;
			if(this.skipNodes.length) {
				while(this.skipNodes.indexOf(lastBeforeSkip) > -1)
					lastBeforeSkip = lastBeforeSkip.previousSibling;
			}
			
			if(ed.childNodes.length == 1 || !isEmptyParagraph(lastBeforeSkip))
			{
				if(lastBeforeSkip == ed.lastChild)
					ed.appendChild(newEmptyParagraph());
				else
					ed.insertBefore(newEmptyParagraph(), lastBeforeSkip.nextSibling);
			}
		},

		_updateValue : function(force) {
			if(!this._updateValueSkipped)
				this._updateValueSkipped = 0;

			if(!force && (this._updateValueTimeout && this._updateValueSkipped++ < 50))
				return;

			if(this._updateValueTimeout)
			{
				clearTimeout(this._updateValueTimeout);
				this._updateValueTimeout = null;
			}

			this._updateValueSkipped = 0;

			this.selectionSave();

			// this is too much work to execute on every event
			// so we schedule it once per 400ms as long as there are actions happening
			this._updateValueTimeout = setTimeout(function() {
				var val, sameContent, d;
				var bottomPadding, topPadding, that = this, editor = this.$.editor;

				if(this.__actionData.target)
					this.__actionData.target.style.border = this.__actionData.border;

				val = this.getCleanValue();
				
				if(!this.$.editor.querySelector('span.paragraph'))
					val = '<span class="paragraph">' + val + '</span>';

				this.frameContent();
				this.skipNodes = this.domProxyManager.createProxies();

				this._updateValueTimeout = null;

				sameContent = val == this.value;
				
				this.selectionSave();
				this.customUndo.pushUndo(false, sameContent);

				if(!force && sameContent)
					return;

				this.value = val;

				this.textValue = this.$.editor.innerText;
				
				if(val != this._initialValue)
					this.fire('change');
				else
					this.fire('unchange');
				
				
				
				this.$.editor.style.minHeight = this.$.editor.scrollHeight;

				/*if(that.customUndo.lastTimeout)
					clearTimeout(that.customUndo.lastTimeout);
				that.customUndo.lastTimeout = setTimeout(function() {
					that.customUndo.pushUndo(false);
				}, 1000);*/

				//if(this.__actionData.target)
				//	this.__actionData.target.style.border = "3px dashed grey";

			}.bind(this), 400);
		},

		getCleanValue : function() {
			var v;
			this.removeActionBorder();

			v = recursiveInnerHTML(this.$.editor, this.skipNodes)
					.replace(/^(\r\n|\n|\r)/,"")
					.replace(/(\r\n|\n|\r)/gm,"<br>")
					.replace(/\<pre\>/gmi,"<span>").replace(/\<\/?pre\>/gmi,"</span>")
					.replace(/^\s*(\<span class="paragraph"\>\<br\>\<\/span\>\s*)+/, '')
					.replace(/\s*(\<span class="paragraph"\>\<br\>\<\/span\>\s*)+$/, '')
					// .replace(/&#8203;/gmi, '') 				// special chars
					.replace(/\<span\>​<\/span\>/gmi, '') 	// empty spans are useless anyway. or are they?
					.trim();

			if(!/\<[^\<]+\>/.test(v))
				v = '<span class="paragraph">' + v + "</span>"
					
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

		properties : {
			commands : {
				type : String,
				value : "bold,italic,underline,insertOrderedList,insertUnorderedList,align-left,justifyLeft,justifyCenter,justifyRight,insertImage,foreColor,backColor,,indent,outdent,insertHorizontalRule,,copy,cut"
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
				value : 0 /*,
				observer : "viewModeChanged"*/
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
			}
		},

		behaviors: [
			ir.ReflectToNativeBehavior,
			ir.SelectorBehavior
		],

	})

	// custom undo engine

	function CustomUndoEngine(editor, options)  {
		var undoRecord = [],
			redoRecord = [],
			lastRestoredStateContent,
			getValue = options.getValue || function() { return editor.innerHTML };

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
				pushUndo(true);
				lastRestoredStateContent = lastRedo.content;
			}
		}

		var restoreState = function(state)
		{
			var stateRange = state.range, sn, en, so, eo, smax, emax;

			editor.innerHTML = options.contentFrame.replace('[content]', state.content);

			//setTimeout(function() {
			r = document.createRange();

			Polymer.dom.flush();

			//console.log('restoring:');
			//console.log(stateRange.startMemo.positionArray, stateRange.startOffset);
			
			sn = (stateRange && stateRange.startMemo && stateRange.startMemo.restore()) || editor;
			en = (stateRange && stateRange.endMemo && stateRange.endMemo.restore()) || sn;
			so = sn ? stateRange.startOffset : 0;
			eo = sn && en ? stateRange.endOffset : 0;

			// console.log("in restore state: ", stateRange.startMemo.positionArray, sn, so);
			/*if(sn.nodeType != 3 && sn.childNodes[so])
			{
				sn = sn.childNodes[so];
				so = sn.length;
			}*/

			/*if(en.nodeType != 3 && en.childNodes[eo])
			{
				en = en.childNodes[eo];
				eo = en.length;
			}*/
			smax = sn.nodeType == 1 ? sn.childNodes.length - 1 : sn.length;
			smax = smax >= 0 ? smax : 0;
			
			emax = en.nodeType == 1 ? en.childNodes.length - 1 : en.length;
			emax = emax >= 0 ? emax : 0;

			//if(so < smax || se < emax)
			//	adjustToLast = true;
			
			so = so < smax ? so : smax;
			eo = eo < emax ? eo : emax;

			//if(adjustToLast)
			//	if(!prevNode)
			
			r.setStart(sn, so);
			r.setEnd(en, eo);

			editor.focus();

			sel = document.getSelection();

			sel.removeAllRanges();
			sel.addRange(r);
			if(options.onRestoreState)
				options.onRestoreState(sn);
		}

		var pushUndo = function(force, onlyUpdateRangeMemo) {
			var r, sel, startMemo, endMemo, sc, ec, t,
				innerHTML, onlyUpdateRangeMemo;

			if(!onlyUpdateRangeMemo || undoRecord.length <= 1)
			{
				innerHTML = getValue();
				onlyUpdateRangeMemo = false;
			}
				
			if(!onlyUpdateRangeMemo && undoRecord.length > 1 && (undoRecord[undoRecord.length-1].content == innerHTML))
				onlyUpdateRangeMemo = true;

			lastRestoredStateContent == null;

			while(undoRecord.length >= options.maxUndoItems)
				undoRecord.shift();

			sel = window.getSelection();
			if(sel.rangeCount)
			{
				r = sel.getRangeAt(0);
				
				t = r.startContainer;
				while(t != editor)
				{
					t = t.parentNode;
					if(!t) 
						return;
				}
				
				sc = r.startContainer == editor ? editor : (getTopCustomElementAncestor(r.startContainer, editor) || r.startContainer);
				ec = r.endContainer  == editor ? editor : (getTopCustomElementAncestor(r.endContainer, editor) || r.endContainer);
				startMemo = getDomPathMemo(sc, editor);
				endMemo = getDomPathMemo(ec, editor);

				if(onlyUpdateRangeMemo && undoRecord.length > 1)
				{
					//if(undoRecord.length > 2) // && !(startMemo.positionArray.length == 1 && !startMemo.positionArray[0]))
					//console.log("only update pos, replacing ", undoRecord[undoRecord.length - 1].range.startMemo.positionArray, undoRecord[undoRecord.length - 1].range.startOffset, " with ", startMemo.positionArray, r.startOffset);
					undoRecord[undoRecord.length - 1].range = { startMemo : startMemo, endMemo : endMemo, startOffset : r.startOffset, endOffset : r.endOffset };
				}
				else
				if(typeof innerHTML != 'undefined')
					undoRecord.push({ content : innerHTML, range : { startMemo : startMemo, endMemo : endMemo, startOffset : r.startOffset, endOffset : r.endOffset }});
			
			//console.log('pushing:');
			//console.log(startMemo.positionArray, r.startOffset);

			}
			else
			{
				startMemo = endMemo = getDomPathMemo(editor, editor);
				undoRecord.push({ content : innerHTML, range : { startOffset : 0, endOffset : 0 }});;
			}

			if(!force && !onlyUpdateRangeMemo && redoRecord.length > 0 && lastRestoredStateContent != innerHTML)
				redoRecord = [];

			/*console.log("Undo: ", undoRecord.length, undoRecord);
			console.log("Redo: ", redoRecord.length, redoRecord);
			console.log("Total: ", undoRecord.length + redoRecord.length);*/
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

		pushUndo(true);

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

		return Array.prototype.map.call(el.childNodes, function(node) {
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

	var tagOutline = function(el){ // effectively outerHTML - innerHTML
		var nn = el.cloneNode(false),
			d = document.createElement('div'),
			classList;

		if(nn.classList)
		{
			var classList = Array.prototype.map.call(nn.classList, function(n){return n});

			classList.forEach(function(cl) { if(isCustomElementName(cl)) nn.classList.remove(cl); });
			nn.classList.remove('style-scope');

			if(!nn.classList.length) nn.removeAttribute("class");
		}


		d.appendChild(nn);

		while(nn.childNodes.length)
			nn.removeChild(nn.childNodes[0]);

		return d.innerHTML;
	}

	var recursiveOuterHTML = function(node, skipNodes){
		var outerHTML, innerHTML, childNodes, res;

		if(skipNodes && skipNodes.indexOf(node) > -1)
			return "";

		if(node.nodeType == 3)
			return node.textContent;

		//if(!node.is && node.outerHTML)
		//	return node.outerHTML;

		childNodes = node.is ? Polymer.dom(node).childNodes : node.childNodes;
		if(!childNodes.length)
			return tagOutline(node);

		innerHTML = Array.prototype.map.call(childNodes, function(n) { return recursiveOuterHTML(n, skipNodes) }).join('');

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

	var getChildPositionInParent = function(child) {
		var i, cn, p;
		if(!child || child == document.body)
			return null;

		cn = child.parentNode.childNodes; //Polymer.dom(child).parentNode.childNodes;
		for(i=0; cn[i] != child && i < cn.length; i++)
			;

		return cn[i] == child ? i : null;
	}

	var getChildPathFromTop = function(child, top) {
		var t, p;

		if(!child || (child == document.body && top != document.body) )
			return null;
		if(child == top)
			return [];

		p = child.parentNode; //Polymer.dom(child).parentNode;
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

	var setCaretAt = function(target, offset) {
		var sel = window.getSelection(),
			range = document.createRange();

		range = range.cloneRange();
		range.setStart(target, offset);
		range.setEnd(target, offset);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		
		return range;
	};

	function nextNode(node, excludeChildren) {
		if (!excludeChildren && node && node.hasChildNodes && node.hasChildNodes()) {
			return node.firstChild;
		} else {
			while (node && !node.nextSibling) {
				node = node.parentNode || Polymer.dom(node).parentNode;
			}
			if (!node) {
				return null;
			}
			return node.nextSibling;
		}
	}

	function prevNode(node) {
		var ni;
		if(node.previousSibling)
			return node.previousSibling;
		else
			return node.parentNode;
	}

	// previous sibling in deep sense - will look up the tree until there's a prevousSibling, then will look at the last (rightmost) node in its subtree
	function prevNodeDeep(node, top, opts) {
		var ni;

		if(!node)
			return;
		
		opts = opts || {};
		opts.atomic = opts.atomic || [];
		
		ni = node;
		if(!ni.previousSibling)
		{
			ni = node.parentNode;		
			while(ni && ni != top && !ni.previousSibling)
				ni = ni.parentNode;
		}
		
		if(!ni || ni == top)
			return top;
		
		ni = ni.previousSibling;
		
		if(ni.is && opts.atomicCustomElements)
			return ni;
		
		while(ni && ni.childNodes && ni.childNodes.length && !(ni.is && opts.atomicCustomElements) &&
				!(ni.matchesSelector && opts.atomic.filter(function(s) { return ni.matchesSelector(s) }).length ))
			ni = ni.childNodes[ni.childNodes.length - 1];
		
		return ni;
	}
	
	var ensureCaretIsInLightDom = function(top, reverseDirection) {
		var r = getSelectionRange(), slc, elc;

		if(!r)
			return;

		slc = getClosestLightDomTarget(r.startContainer, top),
		elc = getClosestLightDomTarget(r.endContainer, top);

		if((r.startContainer == slc || slc == top) && (r.endContainer == elc || elc == top))
			// this should in most cases be true except for when the user managed to move the caret into local dom.
			return;

		// otherwise move the caret outside the shadow dom
		return reverseDirection ? moveCaretBeforeOrWrap(slc, elc, top) : moveCaretAfterOrWrap(slc, elc, top);
				// moveCaretAfterOrWrap(slc, elc);


	}

	function isZeroWidthDummyNode(ns) {
		return ns && ns.tagName == 'SPAN' && ns.innerHTML.length == 1 //(ns.innerHTML.length == 1) && (ns.innerHTML.charCodeAt(0) == 8203)
	}
	function newZeroWidthDummyNode() {
		var zwd;

		zwd = document.createElement('span');
		zwd.innerHTML = "<br>";
		//zwd.innerHTML = "&#8203;";

		return zwd;
	}

	// params: slc - range start node, elc - range end node
	// if slc != elc will select from before slc to after elc
	// otherwise will set caret after slc
	function moveCaretAfterOrWrap(slc, elc, top) {
		var ns, targetNode, so, sp, created,
			sel = window.getSelection(),
			range = document.createRange(),
			t, isLast;
			//sel = window.getSelection(),
			//range = document.createRange(),

		range = range.cloneRange();
		//range = range.cloneRange();

		if(!top)
			throw new Error('No top was provided');
		
		if(!slc) return
		if(!elc) elc = slc;

		if(slc == elc)
		{
			// note the order of things here is a bit different from the matching moveCaretBeforeOrWrap
			ns = nextNode(slc, true);
			while(ns && (ns == slc || (ns.parentNode == slc || !isInLightDom(ns, top) || !(canHaveChildren(ns) || ns.nodeType == 3)))) // || !canHaveChildren(ns) 
					ns = nextNode(ns);

			if(ns == top || (isLast = (!ns && slc.parentNode == top)))
			{
				created = document.createElement('span');
				if(isLast)
					slc.parentNode.appendChild(created);
				else
					slc.parentNode.insertBefore(created, ns);
				
				ns = created;
				ns.classList.add('paragraph');
				ns.innerHTML = "<br>"
			}
			if(!ns)
				throw new Error("couldn't find a good place to set the cursor")		
			if(isSpecialElement(ns) || isSpecialElement(ns.firstChild))
			{
				ns.parentNode.insertBefore(t = newEmptyParagraph(), ns);
				ns = created = t;
			}
			
			offset = 0;
			if(ns.nodeType == 3)
			{
				offset = getChildPositionInParent(ns);
				ns = ns.parentNode
			}

			range.setStart(ns, offset);
			range.setEnd(ns, offset);
			range.collapse(true);
		}
		else
		{
			range.setStartBefore(slc);
			range.setEndBefore(slc);
		}

		sel.removeAllRanges();
		sel.addRange(range);

		return range;
	}

	function moveCaretBeforeOrWrap(slc, elc, top) {
		var sel = window.getSelection(), created, t,
			range = document.createRange(), zeroWidthDummy,
			ns, fromNode;

		if(!top)
			throw new Error('No top was provided');

		range = range.cloneRange();

		if(!slc) return
		if(!elc) elc = slc;

		if(slc == elc)
		{
			ns = prevNodeDeep(fromNode = slc, top);
			while(ns && ns != top && (ns == slc || ns.parentNode == slc || !isInLightDom(ns, top))) // || !(canHaveChildren(ns) || ns.nodeType == 3))) // the last one needed to not get stuck on img inside custom element // || !(!canHaveChildren(ns) && getTopCustomElementAncestor(ns, top))*/ || (slc.is && fromNode == slc))) // || (slc.is && ns.children[0] == slc))) // !canHaveChildren(ns) || 
				ns = prevNodeDeep(fromNode = ns, this.$.editor);

			if(!ns)
				throw new Error("couldn't find a good place to set the cursor")
			if(ns == top)
				slc.parentNode.insertBefore(ns = created = newZeroWidthDummyNode(), slc);
			if(ns.is)
			{
				ns.parentNode.insertBefore(t = created = newZeroWidthDummyNode(), ns);
				ns = t;
			}

			if((offset = ns.nodeType) == 3)
				offset = ns.textContent.length;
			else
			if(!canHaveChildren(ns))
			{
				offset = getChildPositionInParent(ns);
				ns = ns.parentNode
			}
			else
			{
				offset = fromNode.parentNode == ns ? getChildPositionInParent(fromNode) : ns.childNodes.length - 1;
				if(offset < 0) 
					offset = 0;
			}

			range.setStart(ns, offset);
			range.setEnd(ns, offset);
			range.collapse(true);
		}
		else
		{
			range.setStartBefore(slc);
			range.setEndAfter(elc);
		}

		sel.removeAllRanges();
		sel.addRange(range);

		return range;
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
		
		if(node.nodeType == 1 && (offset || offset == 0))
			node = node.childNodes[offset];
		
		if(!node || (node.nodeType == 1 && !canHaveChildren(node)))
			if(offset)
				return { container : node, offset : offset }
			else
				return null;
		
		if(node.nodeType == 1)
		{
			if(node.childNodes.length)
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
	splitNode = function(node, offset, limit) { 
	  var parent = limit.parentNode;
	  var parentOffset = getChildPositionInParent(limit); //parent, limit);

	  var doc = node.ownerDocument;  
	  var leftRange = doc.createRange();
	  leftRange.setStart(parent, parentOffset);
	  leftRange.setEnd(node, offset);
	  var left = leftRange.extractContents();
	  parent.insertBefore(left, limit);
	  return limit;
	}
	
	// modified code by Tim Down http://stackoverflow.com/questions/6846230/coordinates-of-selected-text-in-browser-page
	// returns x, y of the current coordinates
	var getSelectionCoords = (function () {
		span = document.createElement("span");
		span.appendChild( document.createTextNode("\u200b") );
		
		return function _getSelectionCoords(win)
		{
			win = win || window;
			var doc = win.document, offsetParent;
			var sel = doc.selection, range, rects, rect;
			var x = 0, y = 0;
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
								
							var spanParent = span.parentNode;
							spanParent.removeChild(span);

							// Glue any broken text nodes back together
							spanParent.normalize();
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
			maxOffset = (r.startContainer.length || (r.startContainer.childNodes && r.startContainer.childNodes.length)) - 1
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
	
	function visitNodes(root, visitor, opts) {
		var n = root;
		if(!opts) opts = {};

		if(!opts.noRoot) visitor(n)
		if(!n.childNodes || !n.childNodes.length)
		  return;

		Array.prototype.forEach.call(n.childNodes, function(el) { visitNodes(el, visitor) });
	}
	
		
	function isSpecialElement(el) {
		return el && (el.is || (el.matchesSelector && el.matchesSelector('.embed-aspect-ratio'))) && el;
	}
	
	function selfOrLeftmostDescendantIsSpecial(el) {
		return el && (isSpecialElement(el) || 
							isSpecialElement(el.firstChild) || 
							(el.firstChild && el.firstChild.nodeType == 3 && !el.firstChild.textContent && isSpecialElement(el.firstChild.nextSibling)))	
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
				while(right.firstChild)
					left.appendChild(right.removeChild(right.firstChild));
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
})();

