	(function () {
	Polymer({
		is : 'ir-textarea',
		ready : function() {
			var that = this,
				commands = this.commands.split(/,/),
				newButton, cmdDef, icon, ev, handler, altTarget, moveOccured;

			this.skipNodes = [];
			this.__actionData = {};
			
			handler = function(ev) {
				if((ev.type == 'keydown' && ev.keyCode == 8 || ev.keyCode == 46) && that.__actionData.target)
				{
					ev.preventDefault();
					that.deleteTarget(that.__actionData.target);
				}

				altTarget = getTopParentCustomElement(ev.target, that.$.editor) || ev.target.proxyTarget;
				if(ev.type == 'mousedown' && altTarget && that.__actionData.type != 'drag' && 
					(altTarget == getClosestLightDomTarget(altTarget, that.$.editor) || 			// we're either 
					!(ev.target.childNodes.length == 1 && ev.target.childNodes[0].nodeType == 3)))
				{
					console.log(ev.target);
					that.moveTarget.call(that, altTarget);
					ev.preventDefault();
				}

				ensureCaretIsInLightDom(that.$.editor);

				if(ev.type == 'mouseup')
				{
					if(that.__actionData.dragTarget)
					{
						moveOccured = that.moveTarget.call(that, that.__actionData.dragTarget, true);
						if(moveOccured)
							ev.preventDefault();
					}
				}

				that._updateValue();
			};

			"mousedown,mouseup,keydown,keyup".split(',')
				.forEach(function(evType)
				{
					that.$.editor.addEventListener(evType, handler);
					that.selectionSave();
				});

			this.domProxyManager = ir.DomProxyManager.getProxyManager( // last argument maps selector->transformation for cases when target is not the dimensions source
										':not(.embed-aspect-ratio)>iframe,.embed-aspect-ratio', 
										{ rootNode : this.$.editor, createRootNode : this.$.editor, fromElement : this.$.editor },
										{ '.embed-aspect-ratio' : function(el) { return el.childNodes[0]; } }
									);

			this.$.editor.addEventListener('click', this.contextMenuShow.bind(this), true); // capturing phase

			
			var pasteHandler = function(e) {
				var v;
				if(typeof clipboardData != 'undefined')
					v = clipboardData.getData();
				else
					v = e.originalEvent ? e.originalEvent.clipboardData.getData('text/html') : e.clipboardData.getData('text/html');

				that.pasteHtmlAtCaret(v, true);
				
				e.preventDefault();
			};

			that.$.editor.addEventListener('paste', pasteHandler);

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
				that.cleanHTML();
			});

			this.$.mediaEditor.editor = this.$.editor;

			this.set('customUndo', CustomUndoEngine(this.$.editor, { 
																		getValue : this.getCleanValue.bind(this),
																		contentFrame : "<p><br></p>[content]<p><br></p>",
																		timeout : false,
																		onRestoreState : function(el) {
																			this.fire('scroll-into-view', el)
																		}.bind(this)
																	}))
		},

		attached: function(){
			this.insertPlugins();
			setTimeout(function() { this._updateValue(); }.bind(this), 300);

			var that = this;

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


						that.set("toolbarstyle",'top:'+ (tbar.headerHeight- tbar.transformOffset) +'px');
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
			});
			
			this.$.editor.innerHTML = this.getCleanValue();
			
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

			parentCustomEl = getTopParentCustomElement(target, this.$.editor);
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
			{
				this.selectForAction(actionTarget || target);
				//this.rangeSelectElement(target);
			}
			
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

			ev.screenX = ev.clientX = ev.detail.x
			ev.screenY = ev.clientY = ev.detail.y
			ev.preventDefault();

			cm.options = [];

			if(target.matchesSelector(menuGroups.resizeable) || (target.proxyTarget && target.proxyTarget.matchesSelector(menuGroups.resizeable)))
				cm.options.push({label: 'Resize', icon: 'icons:size', info: '', value : target, action : this.resizeTarget.bind(this)});

			var imageAction = function(f) {
				return function(param)
				{
					that.resizeTargetStop.call(that, true); // true means force stop dispite the event target being same as current resize target
					
					if(param.target && param.target.proxyTarget)
						param.target = param.target.proxyTarget;
					else
					if(param.proxyTarget)
						param = param.proxyTarget;
					
					f.call(that, param);

					that.clearActionData();
					that._updateValue();
				}
			};

			cm.options.push({label: 'Remove media',  icon: 'icons:align', info: '', value : target, action : imageAction(this.deleteTarget.bind(this))});

			flowTarget = target;

			if(target.is || target.matchesSelector(menuGroups.floatable) || target.proxyTarget.matchesSelector(menuGroups.floatable))
			{
				if(captionWrapper = mediaEditor.captionWrapperGet(target))
					flowTarget = captionWrapper;
				
				floatOptions = [
					{ label: 'default', value : { target : flowTarget, value : "none" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) },
					{ label: 'Left', value : { target : flowTarget, value : "float-left" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) },
					{ label: 'Right', value : { target : flowTarget, value : "float-right" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) }
				];

				cm.options.push({label: 'Float', icon: 'icons:align', info: '', options: floatOptions});
				if(captionWrapper)
					cm.options.push({label: 'Remove caption', icon: 'icons:align', value : target, action : imageAction(mediaEditor.captionRemove.bind(mediaEditor))});
				else
					cm.options.push({label: 'Add caption', icon: 'icons:align', info: '', value : target, action : imageAction(mediaEditor.captionSet.bind(mediaEditor))});
				cm.options.push({label: 'More...',  icon: 'icons:align', info: '', value : target, action : imageAction(mediaEditor.open.bind(mediaEditor))});
			}

			cm._openGroup(ev);
		},

		addActionBorder : function() {
			var t = this.__actionData.target;
			
			if(!t)
				return;

			this.__actionData._border = t.style.border;
			t.style.border = "3px dashed grey";
		},

		removeActionBorder : function() {
			if(!this.__actionData.target)
				return;

			this.__actionData.target.style.border = this.__actionData._border || "none";
		},
		
		selectForAction : function(target, type) {
			var ad = this.__actionData;

			if(this.__actionData.target == target)
				return;
				
			this.clearActionData;

			this.__actionData.target = target;
			this.__actionData.type = type;

			target = getClosestLightDomTarget(target, this.$.editor);
			
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
			var deleteTarget, p, pce;
			if(target.proxyTarget)
				target = target.proxyTarget;

			if(this.__actionData && this.__actionData.target == target)
			{
				target.style.border = this.__actionData.border;
				target = this.__actionData.target;
				this.clearActionData();
			};

			var caption = this.$.mediaEditor.captionRemove(target);
				this.$.mediaEditor.captionRemove(target);

			if(!(deleteTarget = getTopParentCustomElement(target, this.$.editor)))
				deleteTarget = target;
			
			p = deleteTarget.parentNode; // delete target is a top parent custom element, meaning its parent is surely no in another custom element's dom
			if(p.is)
				p = Polymer.dom(p);

			p.removeChild(deleteTarget);
			this._updateValue();

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
					var t, st;

					if(t = st = that.__actionData.resizeTarget)
					{
						if(t.proxyTarget)
						{
							if(t.proxyTarget.matchesSelector('.embed-aspect-ratio'))
							{
								t.proxyTarget.style.width = t.style.width;
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
			var html, actualTarget, handler, caretPosData, moveOccured;
			
			if(this.__actionData.dragTarget && !done)
				return;
			
			if(done)
			{
				actualTarget = this.__actionData.dragTarget.proxyTarget || this.__actionData.dragTarget;
				caretPosData = this.__actionData.caretPosData;
				
				if(caretPosData && caretPosData.node)
					caretPosData.node = getTopParentCustomElement(caretPosData.node, editor) || caretPosData.node;
				
				if((caretPosData && this.isOrIsAncestorOf(this.$.editor, caretPosData.node)) && caretPosData.node != actualTarget)
				{
					this.clearActionData();				
					this.__actionData.caretPosData = null;

					html = recursiveOuterHTML(actualTarget, this.skipNodes);

					ensureCaretIsInLightDom(this.$.editor);
					this.pasteHtmlAtCaret(html);
					actualTarget.parentNode.removeChild(actualTarget);
					
					moveOccured = true;
				}
				else
					this.__actionData.lastAction = null;

				document.removeEventListener('mousemove', this.__actionData.dragMoveListener);
				this.__actionData.dragTarget = null
				
				return moveOccured;
			}

			if(this.__actionData.dragMoveListener)
				document.removeEventListener('mousemove', this.__actionData.dragMoveListener);
				
			this.__actionData.caretPosData = null;
			this.__actionData.dragTarget = target;
			this.__actionData.dragMoveListener = function(event) {
				var ad = this.__actionData;
				var caretPosData = caretPositionFromPoint(event.clientX, event.clientY);
				
				if(!ad.dragTarget)
					document.removeEventListener('mousemove', this.__actionData.dragMoveListener);
				
				if(!caretPosData)
				{
					ad.caretPosData = null;
					return;
				}
				
				if(!ad.caretPosData || ad.caretPosData.node != caretPosData.node || ad.caretPosData.offset != caretPosData.offset)
				{
					setCaretAt(caretPosData.node, caretPosData.offset);
					ensureCaretIsInLightDom(this.$.editor);
					ad.caretPosData = caretPosData;
					ad.caretPosData.changed = true;
					this.__actionData.lastAction = 'drag';
				}
				
			}.bind(this);

			document.addEventListener('mousemove', this.__actionData.dragMoveListener);
			
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
			function nextNode(node) {
				if (node.hasChildNodes()) {
					return node.firstChild;
				} else {
					while (node && !node.nextSibling) {
						node = node.parentNode;
					}
					if (!node) {
						return null;
					}
					return node.nextSibling;
				}
			}

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

		pasteHtmlAtCaret : function(html, removeFormat) {
			var sel, range;

			if (window.getSelection) {
				// IE9 and non-IE
				sel = window.getSelection();
				if (sel.getRangeAt && sel.rangeCount) {
					range = sel.getRangeAt(0);
					range.deleteContents();

					// Range.createContextualFragment() would be useful here but is
					// only relatively recently standardized and is not supported in
					// some browsers (IE9, for one)
					var el = document.createElement("div");
					el.innerHTML = html;
					var frag = document.createDocumentFragment(), node, lastNode;
					
					while ( (node = el.firstChild) ) {
						lastNode = frag.appendChild(node);
					}
					var firstNode = frag.firstChild;					
					
					if(removeFormat)
						this.removeFormat(frag);					
					
					range.insertNode(frag);

					// Preserve the selection
					if (lastNode) {
						range = range.cloneRange();
						range.setStartAfter(lastNode);
						range.collapse(true);
						sel.removeAllRanges();
						sel.addRange(range);
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
			this.selectionRestore();
			this.pasteHtmlAtCaret(html);
		},


		_execCommand : function(cmd, sdu, val) {
			var that = this;
			if(cmd == 'replaceHTML')
				this.insertHTMLCmd(val, true);
			else
			if(cmd == 'insertHTML')
				this.insertHTMLCmd(val);
			else
			if(cmd == 'paste'){
				that.$.editor.focus();
				that.selectionRestore();
				setTimeout(function() {
					document.execCommand('Paste');
				}, 300);
			}
			else
				document.execCommand(cmd, sdu, val);
			/*
				if(cmd == 'cut' || cmd == 'copy'){
					this.text = this.getSelectionHtml();
					document.execCommand(cmd, sdu, val);
			}

			else*/
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

			if(!presetVal && promptProcessor)
			{
				promptProcessor.prompt(function(val) {
					var ext, isHtml = /</.test(val);
					if(!isHtml)
						ext = val.match("([^\.]+)$")[1];

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
							that.selectionRestore();
							that._execCommand(actualCmd, false, val);
							that.$.editor.focus();

							//that.selectionForget();
						}
					}

					that._updateValue();
				});

				return;
			}

			//this.$.editor.focus();
			this.async(function() {
				//this.selectionRestore();

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

				//this.async(function() {
				//	this.selectionForget();
				//});

				this.$.editor.focus();
				this._updateValue();
			});
		},
		
		selectionSave : function () {
			this._selectionRange = getSelectionRange();
		},

		selectionRestore : function () {
			var range = this._selectionRange, sel;
			if (range) {
				if (window.getSelection) {
					sel = window.getSelection();
					sel.removeAllRanges();
					sel.addRange(range);
				} else if (document.selection && range.select) {
					range.select();
				}
			}
		},

		selectionForget : function() {
			this._selectionRange = null;
		},
		
		ensureCursorLocationIsValid : function() {
			var sni;
			
			// ensure caret is not in:
			
			// light dom
			ensureCaretIsInLightDom(this.$.editor);
			
			// proxies
			if(sni = this.skipNodes.indexOf(n))
				moveCaretPast(this.skipNodes[n]);
			
			// caption-wrapper
			//if()
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
			var ed = this.$.editor, nn, i, d,

				isFramingEl = function(d) { return 	d.tagName &&
													d.tagName.toLowerCase() == 'p' &&
													d.childNodes.length == 1 &&
													d.childNodes[0].tagName &&
													d.childNodes[0].tagName.toLowerCase() == 'br'; },
				newFramingEl = function() { var el; el = document.createElement('p'); el.appendChild(document.createElement('br')); return el };

			if(!ed.childNodes.length)
				return ed.appendChild(newFramingEl());

			if(!isFramingEl(ed.childNodes[0]))
				ed.insertBefore(newFramingEl(), ed.childNodes[0]);

			if(ed.childNodes.length > 1 && !isFramingEl(ed.childNodes[ed.childNodes.length - 1]))
				ed.appendChild(newFramingEl());
		},

		_updateValue : function(force) {
			if(!this._updateValueSkipped)
				this._updateValueSkipped = 0;
				
			if(!force && (this._updateValueTimeout && this._updateValueSkipped++ < 30))
				return;

			if(this._updateValueTimeout)
			{
				clearTimeout(this._updateValueTimeout);
				this._updateValueTimeout = null;
			}
			
			this._updateValueSkipped = 0;

			// this is too much work to execute on every event
			// so we schedule it once per 500ms as long as there are actions happening
			this._updateValueTimeout = setTimeout(function() {			
				var val;
				var bottomPadding, topPadding, that = this, editor = this.$.editor;

				if(this.__actionData.target)
					this.__actionData.target.style.border = this.__actionData.border;

				val = this.getCleanValue();

				this.frameContent();
				this.skipNodes = this.domProxyManager.createProxies();

				this._updateValueTimeout = null;

				if(!force && val == this.value)
					return;

				this.selectionSave();

				this.value = val;				

				this.customUndo.pushUndo(false);
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
					.replace(/(\r\n|\n|\r)/gm," ")
					.replace(/\<pre\>/gmi,"<span>").replace(/\<\/?pre\>/gmi,"</span>")
					.replace(/^\s*(\<p\>\<br\>\<\/p\>\s*)+/, '')
					.replace(/\s*(\<p\>\<br\>\<\/p\>\s*)+$/, '')
					.trim(); 
					
			this.addActionBorder();
			
			return v;
		},

		_focusedEditor : function() {
			//this.selectionRestore();
		},

		_blurredEditor : function() {
			this.selectionSave();
		},

		/*viewModeChanged : function(to, from)
		{
			if(from == 1 && to == 0)
			{
				this.cleanHTML();
				this.$.
			}
		},*/

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
			this.customUndo.undo();
		},
		redo : function() {
			this.customUndo.redo();
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
			if(!options.maxUndoItems) options.maxUndoItems = 30;
			if(typeof options.timeout == 'undefined') options.timeout = 15000;

			var undoCommand = function() {
				var sel, r, lastUndo, lur, currState;

				if(!undoRecord.length)
					return;

				currState = undoRecord[undoRecord.length - 1];

				if(undoRecord.length > 1)
					redoRecord.push(undoRecord.pop());
				
				lastUndo = undoRecord[undoRecord.length - 1];
				
				if(undoRecord.length > 1)
					undoRecord.pop();
								
				//pushUndo(true);
				//redoRecord.push(currState = undoRecord.pop());

				//if(lastUndo.content == currState.content && undoRecord.length > 0)
				//	lastUndo = undoRecord.pop();

				if(!lastUndo || lastUndo.content == currState.content)
					return;

				restoreState(lastUndo);
				lastRestoredStateContent = lastUndo.content;
			}

			var redoCommand = function(e) {
				var sel, r, lastRedo = redoRecord.pop();

				if(lastRedo)
				{
					pushUndo(true);
					restoreState(lastRedo);
					lastRestoredStateContent = lastRedo.content;
				}
			}

			var restoreState = function(state)
			{
				var stateRange = state.range, sn, en, so, eo;

				sel = document.getSelection();

				editor.innerHTML = options.contentFrame.replace('[content]', state.content);

				//setTimeout(function() {
				sel.removeAllRanges();
				r = document.createRange();

				Polymer.dom.flush();

				sn = (stateRange && stateRange.startMemo && stateRange.startMemo.restore()) || editor;
				en = (stateRange && stateRange.endMemo && stateRange.endMemo.restore()) || sn;
				so = sn ? stateRange.startOffset : 0;
				eo = sn && en ? stateRange.endOffset : 0;
				
				if(sn.nodeType != 3)
				{
					sn = sn.childNodes[0];
					so = so < sn.length ? so : sn.length;
				}
				so = so < sn.length ? so : sn.length;
				
				if(en.nodeType != 3)
				{
					en = en.childNodes[0];
					eo = eo < en.length ? eo : en.length;
				}
				eo = eo < en.length ? eo : en.length;
										
				r.setStart(sn, so);
				r.setEnd(en, eo);

				sel.removeAllRanges();
				editor.focus();
				sel.addRange(r);
				if(options.onRestoreState)
					options.onRestoreState(sn);
				//});

			}

			var pushUndo = function(force) {
				var r, sel, startMemo, endMemo, sc, ec,
					innerHTML = getValue();

				if(!force && undoRecord.length && (undoRecord[undoRecord.length-1].content == innerHTML))
					return;

				lastRestoredStateContent == null;

				while(undoRecord.length >= options.maxUndoItems)
					undoRecord.shift();

				sel = window.getSelection();
				if(sel.rangeCount)
				{
					r = sel.getRangeAt(0);
					sc = r.startContainer == editor ? editor : (getTopParentCustomElement(r.startContainer, editor) || r.startContainer);
					ec = r.endContainer  == editor ? editor : (getTopParentCustomElement(r.endContainer, editor) || r.endContainer);
					startMemo = getDomPathMemo(sc, editor);
					endMemo = getDomPathMemo(ec, editor);
					undoRecord.push({ content : innerHTML, range : { startMemo : startMemo, endMemo : endMemo, startOffset : r.startOffset, endOffset : r.endOffset }});
				}
				else
				{
					startMemo = endMemo = getDomPathMemo(editor, editor);
					undoRecord.push({ content : innerHTML, range : { startOffset : 0, endOffset : 0 }});;
				}

				if(!force && redoRecord.length > 0 && lastRestoredStateContent  != innerHTML)
					redoRecord = [];	

				console.log(undoRecord);
				console.log(redoRecord);
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
				redo : redoCommand
			}
		}


		var recursiveInnerHTML = function(el, skipNodes) {
			skipNodes = skipNodes || [];
			
			if(!((el.is ? Polymer.dom(el) : el).childNodes.length))
				return "";

			return Array.prototype.map.call(el.childNodes, function(node) {
					if(skipNodes.indexOf(node) > -1)
						return "";
					
					if((node.is ? Polymer.dom(node) : node).childNodes.length)
						return recursiveOuterHTML(node, skipNodes);
					else
						return tagOutline(node);
				}).join('');
		}

		var isCustomElementName = (function(n) {
			var cache = {};
			return function(tagName) {
				var c = cache[tagName];
				if(c)
					return c;
				else
					return cache[tagName] = !!document.createElement(tagName).is;
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

			if(skipNodes.indexOf(node) > -1)
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
			while(n && n != top)
			{
				if(n.is)
					customParents.push(n);
				n = n.parentNode;
			}
			while(customParents.length)
			{
				n = customParents.pop();
				cn = Polymer.dom(n).childNodes;

				for(i = 0; !goDeeper && i < cn.length; i++)
				{
					if(cn[i] == node)
						return node

					goDeeper = (cn[i] == customParents[customParents.length-1]);
				}
				if(!goDeeper && customParents.length)
					return n;
			}

			return node;
		}

		// returns topmost custom element or null
		var getTopParentCustomElement = function(node, top) {
			var res = null;
			while(node && node != top && node.is != document.body)
			{
				if(node.is)
					res = node;

				node = node.parentNode;
			}

			return res;
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
				if(pathArr[++i] || pathArr[i] === 0)
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
		};
		
		//var setCaretAfterIf(condition, 
		
		var ensureCaretIsInLightDom = function(top) {
			var r = getSelectionRange(), slc, elc;
			
			if(!r)
				return;
		
			slc = getClosestLightDomTarget(r.startContainer, top),
			elc = getClosestLightDomTarget(r.endContainer, top);

			if(r.startContainer == slc && r.endContainer == elc)
				// this should in most cases be true except for when the user managed to move the carret into the shadow dom.
				return;
			
			var sel = window.getSelection(), 
				range = document.createRange();

			range = range.cloneRange();
			
			if(slc == elc)
			{
				range.setStartAfter(slc);
				range.setEndAfter(elc);
				range.collapse(true);
			}
			else
			{
				range.setStartBefore(slc);
				range.setEndAfter(elc);
			}
			
			sel.removeAllRanges();
			sel.addRange(range);
			// otherwise move the caret outside the shadow dom
						
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

		function getElementCoordinates (elem) 
		{
			var elem, xPos, yPos;

			yPos = elem.offsetTop;
			xPos = elem.offsetLeft;
			tempEl = elem.offsetParent;

			while ( tempEl != null ) 
			{
				xPos += tempEl.offsetLeft;
				yPos += tempEl.offsetTop;
				tempEl = tempEl.offsetParent;
			}  

			return { x : xPos, y : yPos };
		}
})();
