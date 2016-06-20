// ir-textarea
// A wysiwyg  editor for Polymer 1.0+

// Version: 0.83 

(function () {
	var utils = window.ir.textarea.utils,
		inputHandlers = window.ir.textarea.inputHandlers,
		paste = window.ir.textarea.paste,
		editorMutationHandler = window.ir.textarea.editorMutationHandler,
		CustomUndoEngine = window.ir.textarea.CustomUndoEngine,
		deletes = window.ir.textarea.deletes;

	console.log('ir-textarea');

	Polymer({
		is : 'ir-textarea-delimiter'
		
	});
	Polymer({
		is : 'ir-textarea',
		ready : function() {
			var that = this, commands = this.commands.split(/,/);

			this.changed = true;

			this.$.range.editor = this; //.$.editor;
			this.range = this.$.range; //.$.editor;
			
			this.__actionData = {};
			
			// custom user input handlers
			/*this.bindHandlers("keydown,keyup", inputHandlers.previewHotKey, this.$.editor);
			this.bindHandlers("keydown,keyup,mousedown,mouseup", inputHandlers.clearActionData, this.$.editor);
			this.bindHandlers("keydown,keyup", inputHandlers.enterKey, this.$.editor);
			this.bindHandlers("keydown,keyup", inputHandlers.navigationKeys, this.$.editor);
			this.bindHandlers("mousedown,mouseup", inputHandlers.dragAndDrop, this.$.editor);
			this.bindHandlers("keydown,keyup,keypress", deletes.handler, this.$.editor);
			*/
			// paste
			this.bindHandlers('paste', paste.pasteHandler, this.$.editor);
			//this.$.editor.addEventListener('copy', function() {console.log('hi copy')} );

			// don't do this unless you want every action recorded in undo
			// this.bindHandlers("mousedown,mouseup,keydown,keyup,keypress", function() { this.customUndo.pushUndo(); }.bind(this));
			
			this.bindHandlers("mousedown,mouseup,keydown,keyup,keypress", this.selectionSave, this.$.editor);

			// resize handler
			this.$.resizeHandler.addEventListener('mousedown', function(ev) { ev.preventDefault(); });
			this.$.resizeHandler.addEventListener('mousemove', function(ev) { ev.preventDefault(); });

			// context menu
			this.bindHandlers('click', this.contextMenuShow, this.$.editor, true); // capturing phase

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
																		//contentFrame : '[content]', // '[content]<span class="paragraph"><br></span>',
																		timeout : false,
																		isDisabled : function() {
																			return true;
																			return this.disabled;
																		}.bind(this),
																		onRestoreState : function(el) {
																			this.selectionSave()
																		}.bind(this)
																	}))
		},
		
		// bind all `eventTypes` to all given `handlers` on `target`
		bindHandlers : function(eventTypes, handlers, target, capturingPhase)
		{
			if(typeof eventTypes == 'string') eventTypes = eventTypes.split(',');
			if(!(handlers instanceof Array)) handlers = [handlers];
			var wrappedHandlers = handlers.map(function(h) {
				return function(ev) {
					if(this.disabled)
						return;
					
					return h.call(this, ev);
				}.bind(this);
			}.bind(this));
			
			if(!target) target = this;
			
			eventTypes.forEach(function(et) { 
				wrappedHandlers.forEach(function(h) {
					target.addEventListener(et, h, capturingPhase);
				}.bind(this))
			}.bind(this));
		},

		attached: function(){
			var val;
			
			this.insertPlugins();

			this.configureToolbar();

			Object.keys(this.promptProcessors).forEach(function(pp) {
				var el = document.getElementById(this.promptProcessors[pp]);
				if(!el._hasOverlayClosedListener)
					el.addEventListener('iron-overlay-closed', function() { this.selectionRestore(); }.bind(this));

				el._hasOverlayClosedListener = true;
			}.bind(this));

			if(/^\s*$/.test(this.$.editor.innerHTML))
			{
				this.$.editor.innerHTML = "";
				this.$.editor.appendChild(utils.newEmptyParagraph());
			}

			// set up and start the observer
			this.observerCycle = 0;
			this.customElements = [];
			this.editorMutationObserver = new MutationObserver(editorMutationHandler.bind(this));
			this.editorMutationObserverConfig = {
				attributes : true,
				childList : true,
				subtree : true,
				characterData : true,
				characterDataOldValue : true
			}

			this.connectEditorObserver();
			
			//this.$.editor.innerHTML = this.getCleanValue().replace(/\t+/g, '');
			utils.prepareWhitespace(this.$.editor);
			this._initialValue = this.getCleanValue();
			
			this.set('value', this._initialValue); // tab custom element anyone?
		},

		connectEditorObserver : function()
		{
			if(this.editorMutationObserver.isConnected)
				return;
			
			this.editorMutationObserver.observe(this.$.editor, this.editorMutationObserverConfig);
			this.editorMutationObserver.isConnected = true;
		},

		disconnectEditorObserver : function()
		{
			if(!this.editorMutationObserver.isConnected) // may  be called more than once without extra checking
				return;
			
			this.editorMutationObserver.disconnect();
			this.editorMutationObserver.isConnected = false;
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
				
				//if(that.actionTarget)
				that.setResizeHandlerPosition();
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
		
		eventCameFromDialog : function (ev) {
			return ev.path && Polymer.dom(ev).path.filter(function(el) { return el.is == 'paper-dialog' }).length // a simplish way to allow setup dialogs
			
		},

		userInputHandler : function (ev) {
			var altTarget, noMoreSave, el, toDelete, keyCode = ev.keyCode || ev.which, t,
				forcedelete, r, done, localRoot, last, n, nn, pn, pos, firstRange, merge, sc, ec, so, eo, toMerge, previewShortcutListener;

			// undo/redo/copy/paste and right click are handled in their own handlers or their default behavior
			if(([89,90,67,86].indexOf(keyCode) > -1 && ev	) || (['mousedown', 'mouseup', 'click'].indexOf(ev.type) > -1  && ev.which == 3))
				return;
		
			this.selectionSave();
			this.selectionRestore(true);
			
			this._updateValue();
		},

		contextMenuShow : function(ev) {
			var cm = this.$.contextMenu, target = ev.target, flowTarget, captionWrapper,
				mediaEditor = this.$.mediaEditor, that = this, altTarget = ev.target, candidateTarget, parentCustomEl, p, i,
				actionTarget = target,
				menuGroups = {
						resizeable : "video,img,iframe,embedded-media",
						floatable : "video,img,iframe",
						removeable : "video,img,table,iframe"
				},
				actionableTags = [menuGroups.resizeable, menuGroups.floatable, menuGroups.removeable].join(",");

			cm.disabled = true;

			target = actionTarget = utils.getClosestLightDomTarget(target);

			if(this.isDisabled || target.isCaret || target == this)
				return;
			
			if(ev.shiftKey)
				return ev.stopPropagation();

			parentCustomEl = utils.getTopCustomElementAncestor(target, this);
			
			if(parentCustomEl)
			{			
				ev.stopPropagation();
				ev.stopImmediatePropagation();
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
				{
					this.resizeTarget(target);

					ev.stopImmediatePropagation();
					ev.stopPropagation();
				}

			// return if just made an action
			if(this.__actionData.lastAction)
				return this.__actionData.lastAction = null;

			if(this.__actionData.showMenuFor != this.__actionData.target) // show menu next time
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

			cm.options.push({label: '',  info: '', value : target, action : imageAction(null)});

			if(target.matchesSelector(menuGroups.resizeable)) // || (target.proxyTarget.matchesSelector(menuGroups.resizeable))) //target.proxyTarget &&
				cm.options.push({label: 'Resize',  info: '', value : target, action : this.resizeTarget.bind(this)});

			cm.options.push({label: 'Remove media', info: '', value : target, action : imageAction(this.deleteTarget.bind(this))});

			flowTarget = target;

			// can only float:
			if((target.is == 'ir-gallery' && Polymer.dom(target).querySelectorAll('img').length == 1) ||    // single-image gallery for now
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
					cm.options.push({label: 'Float', info: '', options: floatOptions});
					if(captionWrapper)
						cm.options.push({label: 'Remove caption', value : target, action : imageAction(mediaEditor.captionRemove.bind(mediaEditor))});
					else
						cm.options.push({label: 'Add caption', info: '', value : target, action : imageAction(mediaEditor.captionSet.bind(mediaEditor))});

					cm.options.push({label: 'More...', info: '', value : target, action : imageAction(mediaEditor.open.bind(mediaEditor))});
				}
			}
			
		  if(parentCustomEl && typeof parentCustomEl.setup == 'function')
			cm.options.push({label: 'Setup...', value : parentCustomEl, action : function() { 
					this.disconnectEditorObserver(); // got to do this or the observer will keep listening for internal changes
					//parentCustomEl.setup.bind(parentCustomEl);
					
					cm.disabled = true;
					this.disabled = true;
					this.clearActionData();
					
					parentCustomEl.setup();
					
					if(!parentCustomEl.closeListener)
						parentCustomEl.closeListener = parentCustomEl.addEventListener('iron-overlay-closed', function() {
							this.disabled = false;
							cm.disabled = false;
							this.connectEditorObserver();
						}.bind(this));
				}.bind(this)
			});

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
		  this.__actionData.deleteTarget = utils.getTopCustomElementAncestor(target, this.$.editor) || this.__actionData.deleteTarget;
		  this.__actionData.type = type;

		  setTimeout(function() {
			//if(this.__actionData.deleteTarget)
			//	utils.setCaretAt.call(this.$.range, this.__actionData.deleteTarget, 0);
		  }.bind(this), 50);

		  this.customUndo.pushUndo(false, false);

		  this.scrollIntoView();

		  this.addActionBorder();
		},

		clearActionData : function() {
			var ad = this.__actionData;

			this.removeActionBorder();

			this.$.resizeHandler.style.display = "none";

			if(ad.target && ad.target.id =='resizable-element')
				 ad.id = '';

			if(ad.resizeOccured)
				ad.showMenuFor = null;

			interact.stop();
			
			ad.resizeOccured = ad.target = ad.deleteTarget = ad.lastAction = ad.type = null;
			
			if(ad.id =='resizable-element') ad.id = '';
		},

		deleteCmd : function() {
			this.userInputHandler({ type : 'keydown', which : 8, preventDefault : function() {} }); // simply emulate a delete keydown
			setTimeout(function() { this.selectionRestore() }.bind(this), 50);			
		},

		deleteTarget : function(target) {
			var deleteTarget, p, pce, cover, isCe;

			if(this.__actionData && this.__actionData.target == target)
			{
				target.style.border = this.__actionData.border;
				target = this.__actionData.target;
				this.clearActionData();
			};


			if(!(deleteTarget = utils.getTopCustomElementAncestor(target, this.$.editor)))
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


			if(interactable)
				interactable.unset();

			this.clearActionData();

			if( target.id =='resizable-element') target.id = '';

			document.removeEventListener('mouseup', this.resizeTargetStop);
			document.removeEventListener('click', this.resizeTargetStop);
		},

		resizeTarget : function(target) {
			this.addActionBorder();
			var that = this, resizeHandler, resizeEndHandler, cbr, ep;

			if(this.__actionData.resizableTarget)
				this.resizeTargetStop(true);

			that.__actionData.resizeTarget = target;
			that.__actionData.type = 'resize';

			document.addEventListener('mouseup', this.resizeTargetStop.bind(this));
			document.addEventListener('click', this.resizeTargetStop.bind(this));

			cbr = target.getBoundingClientRect();
			if(target.tagName == 'IMG')
			{
				target.ratio = cbr.height / cbr.width;
			}

			if(!target.id)
				target.id = 'resizable-element';

			this.setResizeHandlerPosition();
			
			resizeHandler = function (event) {
				this.disabled = true;

				//var target = event.target,
				var bcr, stu,
				computedStyle = target.getBoundingClientRect(),

				x = (parseFloat(target.getAttribute('data-x')) || 0),
				y = (parseFloat(target.getAttribute('data-y')) || 0),


				sw = Number(target.style.width.replace(/px/, '') || 0) || computedStyle.width,
				sh = Number(target.style.height.replace(/px/, '') || 0) || computedStyle.height,
				ratio, w, h;

				//if(!target.ratio) // keep the initial ratio on target, as interactible gets reсreated on every resize start
				//	target.ratio = target._aspect; //sh/sw;;

				//if(target._aspect)
				ratio = target.ratio;

				w = event.rect.width;
				h = ratio ? ratio * w : event.rect.height;

				if(target.tagName == 'IMG' && h / ratio > target.width)
					h = target.width * ratio;

				stu = function(w, h)
				{
					// update the element's style
					target.style.width  = w + 'px';
					target.style.height = h + 'px';

					// in case it's a custom element
					//target.width = w;
					//target.height = h;

					target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px,' + y + 'px)';
					
					target.setAttribute("width", w);
					target.setAttribute("height", h);
				};

				stu(w, h);

				bcr = target.getBoundingClientRect();

				//if(bcr.width != w || bcr.height !=)
				stu(bcr.width, bcr.height);

			that.setResizeHandlerPosition();				

				that.__actionData.dragTarget = null; // resize takes over drag
				that.__actionData.resizeOccured = true;

				event.stopPropagation();
				
				// translate when resizing from top or left edges
				//x += event.dy; //y += event.deltaRect.top;
				//console.log(x);
			}

			resizeEndHandler = function() {
			  var t, st, numW, numH;

				this.disabled = false;
			  
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
				interact.stop();
			}

			//interact(target).resizable({
			interact('#'+target.id).resizable({
				edges: { left: true, right: true, bottom: true, top: true }
			})
			.on('resizemove', resizeHandler)
			.on('resizeend', resizeEndHandler);

			/*if(target.nextSibling)
				utils.setCaretAt(target.nextSibling, 0);
			else
				utils.setCaretAt(target, 0);*/

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
		
		setResizeHandlerPosition : function() {
			var target, cbr, handlercbr, ep;
			
			if(!this.__actionData || !this.__actionData.target)
				return;
			
			target = this.__actionData.target;
			
			handlercbr = this.$.resizeHandler.getBoundingClientRect();
			
			cbr = cbr = target.getBoundingClientRect();
			ep = utils.getElementPosition(target, this.$.editor);

			this.$.resizeHandler.style.left = (ep.x + cbr.width - 25) + "px";
			this.$.resizeHandler.style.top = (ep.y + cbr.height - 25) + "px";
			this.$.resizeHandler.style.display = "block";

			this.$.resizeHandler.proxyTarget = target;
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
			  caretPosData.node = (tpce = utils.getTopCustomElementAncestor(caretPosData.node, editor)) || caretPosData.node;

			if(actualTarget.parentNode && (caretPosData && this.isOrIsAncestorOf(this.$.editor, caretPosData.node)) && !this.isOrIsAncestorOf(actualTarget, caretPosData.node))
			{
			  this.clearActionData();
			  this.__actionData.caretPosData = null;

			  html = utils.recursiveOuterHTML(actualTarget);

			  // for now, forbid explicitly to drop into custom elements. (for custom targets only - built-in text drop is still possible! - e.g., it's ok to move text into a caption inside a gallery)
			  if(tpce)
				utils.setCaretAt(tpce.nextSibling, 0);

			  paste.pasteHtmlAtCaret.call(this, html);
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

		  // track drag target

		  this.__actionData.caretPosData = null;
		  this.__actionData.dragTarget = target;
		  this.__actionData.dragMoveListener = function(event) {
			var ad = this.__actionData;
			var caretPosData = utils.caretPositionFromPoint(event.clientX, event.clientY);

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
			  utils.setCaretAt(caretPosData.node, caretPosData.offset);
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
		  this.range.setAt(this.range.execCommand(ev.target.getAttribute("cmd-name"), ev.target.selected));
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
				rangeNodes.push( node = utils.nextNode(node) );
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

			while (el.childNodes && el.childNodes.length) {
			  movedChildren.push(el.firstChild);
			  parent.insertBefore(el.firstChild, el);
			}
			parent.removeChild(el);

			return movedChildren;
		  }

		  function replaceTagName(el, tag) {
			var nn = document.createElement(tag),
			  parent = el.parentNode, ch;

			while (el.childNodes && el.childNodes.length) {
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


		// to use instead of execCommand('insertHTML') - modified from code by Tim Down
		insertHTMLCmd : function (html) {
			this.selectionRestore();
			// this.customUndo.pushUndo();
			paste.pasteHtmlWithParagraphs.call(this,html);
			Polymer.dom.flush();
			//this._updateValue();
			/*setTimeout(function() {
				// this.customUndo.pushUndo();
			}.bind(this), 50);*/
		},


		_execCommand : function(cmd, sdu, val) {
			var that = this;

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
				//if(this.isCommandPossible(cmd, sdu, val)) {
					//document.execCommand(cmd, sdu, val);
					var q = this.range.execCommand(cmd, sdu, val);
					Polymer.dom.flush();
					this.range.setAt(q);
					/*this.selectionSave();
					setTimeout(function(){
						that.selectionRestore();
					}, 200);*/
				//}
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
					if(!utils.isInLightDom(nn, this.$.editor)) {
						alert('Creation of bulleted list on ranges containing custom elements is not supported due to a but in Chrome (see Chromium bug 571420). As a workaround, create the bulleted list and drag the element there instead.');
						return false;
					}
					nn = utils.nextNode(nn);
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
						}
					}

					Polymer.dom.flush();
					this.async(function() {
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
			var range = utils.getSelectionRange();

			if(range && !range.startContainer.is && this.isOrIsAncestorOf(this.$.editor, range.startContainer))
			{
				this._selectionRange = range;
				this.undoStarted = true;
				
				this.scrollIntoView();
			}
		},

		selectionRestore : function (noForceSelection) {
			var range, sel, sc, ec;

			range = utils.getSelectionRange();

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
					utils.setCaretAt(this.$.editor.appendChild(utils.newEmptyParagraph()), 0);
				else
					utils.setCaretAt(this.$.editor.childNodes[0], 0);
			}

			this._selectionRange = range;

			this.undoStarted = true;
			
			return range;
		},
		
		scrollIntoView : function() {
			this.debounce('scroll-into-view', function() {
				this.fire('scroll-into-view', utils.getSelectionCoords())
				this.setResizeHandlerPosition();
			}, 100);
		},

		_updateValue : function(noForceSelection) {
			var hadChanged = this.changed;

			if(this.disabled)
				return;
			
			if(this.isGettingCoordinates)
				return;
			
			if(this._updateValueTimeout)
				clearTimeout(this._updateValueTimeout);

			
			//console.log((new Date().getTime()) - this._updateValueTime)
			if(!this._updateValueTime || (new Date().getTime()) - this._updateValueTime > 300)
			{
				this.selectionRestore(noForceSelection);
				// this is "regular" undo push invoked by a quick sequence of actions
				
				if(this.undoStarted)
					this.customUndo.pushUndo();
				
				this._updateValueTime = new Date().getTime();
				// console.log('updating value - action');
			}

			//this.customUndo.pushUndo();
			this._updateValueTimeout = setTimeout(function() {
				var p;

				// console.log('updating value - timeout');
				
				// this is "timeout" undo, following up on last action that otherwise wouldn't be pushed by "regular" undo since it's not followed up by an action soon enough
				if(this.undoStarted)
					this.customUndo.pushUndo();

				r = utils.getSelectionRange();

				if(!r)
					return;
				
				if(utils.isDescendantOf(r.startContainer, this.$.editor))
					return this.scrollIntoView();
			}.bind(this), 200);

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

			this.selectionSave();

			this.value = val;

			this.textValue = this.$.editor.textContent;

			if(val != this._initialValue)
				this.fire('change');
			else
				this.fire('unchange');

			this.$.editor.style.minHeight = this.$.editor.scrollHeight + "px";
			this.style.minHeight = this.$.editor.scrollHeight + "px";
		},

		getCleanValue : function(from) {
			var v;

			from = from || this.$.editor;

			if(from == this.$.editor && this.$.editor._cleanValue)
				return this.$.editor._cleanValue;

			this.removeActionBorder();

			if(from == this.$.editor)
				v = utils.recursiveInnerHTML(from)
			else
				v = utils.recursiveOuterHTML(from)

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

			ns = utils.nextNode(slc, false);
			while(ns && ns.parentNode && utils.getTopCustomElementAncestor(ns, top) && !(utils.isInLightDom(ns, top) && ns.nodeType == 3))
				ns = utils.nextNode(ns, false);

			if(slc.is && ns == slc.nextSibling)
			{
				//if(ns.nextSibling.nodeType == 3)
				tc = slc.nextSibling;
				if(!tc.nodeType == 3)
				{
					console.error('Custom element is missing a text wrapper: ', slc.previousSibling, slc, slc.nextSibling)
					throw Error('Custom element is missing a text wrapper: ' + tc.tag);
				}
				return utils.setCaretAt(ns, /^\u0020/.test(ns.textContent) ? 1 : 0);
			}

			return utils.setCaretAt(ns, 0);
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
			if (!this._showing)
			  this.$.toolbar.classList.remove('fixit');
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

		viewModeChanged : function(n, o) {
			if(typeof o == 'undefined')
				return;

			if(this.viewMode == 1)
				this.$.preview.innerHTML = this.value;
			else
			if(this.viewMode == 0)
				this.selectionRestore();
			
			this.diabled = this.viewMode != 0;
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

	
	// polyfill ie11 and older buggy Node.prototype.normalize()
	if(/MSIE|Trident/.test(navigator.userAgent))
		Node.prototype.normalize = 
		function (node) {
		  if (!node) { return; }
		  if (node.nodeType == 3) {
			while (node.nextSibling && node.nextSibling.nodeType == 3) {
			  node.nodeValue += node.nextSibling.nodeValue;
			  node.parentNode.removeChild(node.nextSibling);
			}
		  } else {
			normalize(node.firstChild);
		  }
		  normalize(node.nextSibling);
		}
})();

