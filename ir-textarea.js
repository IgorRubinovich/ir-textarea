(function () {
	Polymer({
		is : 'ir-textarea',
		ready : function() {
			var that = this,
				commands = this.commands.split(/,/),
				newButton, cmdDef, icon, ev, handler;

			handler = function(ev) {
				that._updateValue();
			};

			"mousedown,mouseup,keydown,keyup".split(',')
				.forEach(function(evType)
				{
					that.$.editor.addEventListener(evType, handler);
				});

			var defs = {};
			window.ir.textarea.commands
				.forEach(function(cmdDef) {
					if(commands.indexOf(cmdDef.cmd) > -1)
						defs[cmdDef.cmd] = cmdDef;
				});

			// get them in order
			this.toolbarButtons = commands.map(function(c) { return c ? defs[c] : ""; });

			this.$.htmlTextArea.addEventListener("change", function () { that.$.editor.innerHTML = that.value = that.$.htmlTextArea.value });

			this.$.mediaEditor.editor = this.$.editor;

			this._updateValue();
		},

		contextMenuShow : function(ev) {
			var cm = this.$.contextMenu, target = ev.target, flowTarget = target, captionWrapper,
				mediaEditor = this.$.mediaEditor, that = this;

			if(target.tagName == "A")
				return ev.preventDefault();

			if(!target.tagName.match("IMG|VIDEO") || this._resizeState) // add more as implemented
				return ev.stopPropagation(), ev.stopImmediatePropagation();


			ev.preventDefault();

			cm.options = [];

			cm.options.push({label: 'Resize', icon: 'icons:size', info: '', value : ev.target, action : this.resizeTarget.bind(this)});

			var imageAction = function(f) {
				return function(param)
				{
					that.resizeTargetStop.call(that, true); // true means force stop dispite the event target being same as current resize target
					f.call(that, param);
				}
			};

			if(captionWrapper = mediaEditor.captionWrapperGet(target))
				flowTarget = captionWrapper;

			floatOptions = [
				{ label: 'default', value : { target : flowTarget, value : "none" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) },
				{ label: 'Left', value : { target : flowTarget, value : "left" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) },
				{ label: 'Right', value : { target : flowTarget, value : "right" }, action : imageAction(mediaEditor.setFloat.bind(mediaEditor)) }
			];

			cm.options.push({label: 'Float', icon: 'icons:align', info: '', options: floatOptions});
			if(captionWrapper)
				cm.options.push({label: 'Remove caption', icon: 'icons:align', value : ev.target, action : imageAction(mediaEditor.captionRemove.bind(mediaEditor))});
			else
				cm.options.push({label: 'Add caption', icon: 'icons:align', info: '', value : ev.target, action : imageAction(mediaEditor.captionSet.bind(mediaEditor))});
			cm.options.push({label: 'Remove media',  icon: 'icons:align', info: '', value : ev.target, action : imageAction(this.deleteTarget.bind(this))});
			cm.options.push({label: 'More...',  icon: 'icons:align', info: '', value : ev.target, action : imageAction(mediaEditor.open.bind(mediaEditor))});

			ev.screenX = ev.clientX = ev.detail.x
			ev.screenY = ev.clientY = ev.detail.y

			this.resizeTarget(ev.target);
		},

		deleteTarget : function(target) {
			var caption = this.$.mediaEditor.captionWrapperGet(target);

			if(caption)
				this.$.mediaEditor.captionRemove(target);

			this.selectionSelectElement(target);
			this.async(function() {
				this.execCommand('delete');
			});
		},

		resizeTargetStop : function(ev) {
			if(!(this.__resizeState && (ev === true || ev.target != this.__resizeState.target)))
				return;

			var interactable = this.__resizeState.interactable,
				target = this.__resizeState.target;

			interactable.unset();
			target.style.border = target.style._border || "none";
			document.removeEventListener('click', this.resizeTargetStop);
			this.__resizeState = null;
		},

		resizeTarget : function(target) {
			var that = this, resizeHandler;

			if(this.__resizeState)
				return;

			target.style._border = target.style.border;
			target.style.border = "3px dashed grey";

			document.addEventListener('mouseup', this.resizeTargetStop.bind(this));

			var interactable = interact(target)
				.resizable({
					edges: { left: true, right: true, bottom: true, top: true }
				})
				.on('resizemove', resizeHandler = function (event) {
					var target = event.target,
						computedStyle = getComputedStyle(target),

						x = (parseFloat(target.getAttribute('data-x')) || 0),
						y = (parseFloat(target.getAttribute('data-y')) || 0),

						sw = Number((target.style.width || computedStyle.width).replace(/px/, '')),
						sh = Number((target.style.height || computedStyle.height).replace(/px/, '')),
						ratio, w, h;

					ratio = sh/sw;
					w = event.rect.width;
					h = ratio * w;

					// update the element's style
					target.style.width  = w + 'px';
					target.style.height = h + 'px';

					// translate when resizing from top or left edges
					//x += event.deltaRect.left; //y += event.deltaRect.top;

					target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px,' + y + 'px)';
				})
				.on('resizeend', function() {
					that.__resizeState.justResized = true;
				});

			this.__resizeState = { target : target, interactable : interactable };
		},

		clickedPresetCommand : function(ev) {
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

		removeFormat : function(e) {

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
				var parent = el.parentNode;
				while (el.hasChildNodes()) {
					parent.insertBefore(el.firstChild, el);
				}
				parent.removeChild(el);
			}

			function removeSelectedElements(tagNames) {
				var tagNamesArray = tagNames.toLowerCase().split(",");
				getSelectedNodes().forEach(function(node) {
					if (node.nodeType == 1 &&
						tagNamesArray.indexOf(node.tagName.toLowerCase()) > -1) {
						// Remove the node and replace it with its children
						replaceWithOwnChildren(node);
					}
				});
			}

			removeSelectedElements("h1,h2,h3,h4,h5,h6,p,a,b,i,br,div,span");

		},

		// to use instead of execCommand('insertHTML') - modified from code by Tim Down
		insertHTMLCmd : function (html) {
			var sel, range;
			if (window.getSelection && (sel = window.getSelection()).rangeCount) {
				range = sel.getRangeAt(0);
				range.collapse(true);
				var span = document.createElement("span");

				range.insertNode(span);

				// Move the caret immediately after the inserted span
				range.setStartAfter(span);
				range.collapse(true);
				sel.removeAllRanges();
				sel.addRange(range);

				span.outerHTML = html;
			}
		},


		_execCommand : function(cmd, sdu, val) {
			if(cmd == 'replaceHTML')
				this.insertHTMLCmd(val, true);
			else
			if(cmd == 'insertHTML')
				this.insertHTMLCmd(val);
			else
				document.execCommand(cmd, sdu, val);
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
					ext = val.match("([^\.]+)$")[1];
					test = new RegExp( "<", "g" );
					result = test.test(val);

					if(actualCmd =='insertImage' && ext.match(/\.(mp4|ogg|webm|ogv)$/i)){
						val = "<video controls ><source src='" + val + "' type='video/" + ext + "'></video>"
						document.execCommand("insertHTML", false, val);
					}
					else if(actualCmd =='insertImage' && result){
						document.execCommand("insertHTML", false, val);
					}
					else{
						if(val)
						{
							that.selectionRestore();

							that._execCommand(actualCmd, false, val);

							that.selectionForget();
						}
					}

					that._updateValue();
				});

				return;
			}

			//this.$.editor.focus();
			this.async(function() {
				this.selectionRestore();

				var val, ext;

				if(presetVal)
					val = presetVal;
				else
				if(cmdDef.val)
					val = prompt(cmdDef.val);

				if(actualCmd =='insertImage' && (ext = val.match(/\.(mp4|ogg|webm|ogv)$/i))){
					ext = val.match("([^\.]+)$")[1];

					val = "<video controls><source src='" + val + "' type='video/" + ext + "'></video>"
					document.execCommand("insertHTML", false, val);
				}

				if(!presetVal && cmdDef.val)
					this._execCommand(actualCmd, false, prompt(cmdDef.val));
				else
					this._execCommand(actualCmd, false, presetVal);

				this.selectionForget();

				this._updateValue();
			});
		},

		selectionSave : function () {
			var sel, range;
			if (window.getSelection) {
				sel = window.getSelection();
				if (sel.getRangeAt && sel.rangeCount) {
					range = sel.getRangeAt(0);
				}
			} else if (document.selection && document.selection.createRange) {
				range = document.selection.createRange();
			}

			this._selectionRange = range;
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

		selectionSelectElement : function(el) {
			var range = document.createRange();
			range.selectNode(el);
			var sel = window.getSelection();
			sel.removeAllRanges();
			sel.addRange(range);

			return range;
		},

		_updateValue : function(e) {
			this.value = this.$.editor.innerHTML;
			var h = getComputedStyle(this.$.editor).height;
			this.$.editor.style.minHeight = this.offsetHeight;
		},

		_focusedEditor : function() {
			//this.selectionRestore();
		},

		_blurredEditor : function() {
			this.selectionSave();
		},

		viewModeChanged : function(to, from)
		{
			if(from == 1 && to == 0)
				this.cleanHTML();
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
		},

		properties : {
			commands : {
				type : String,
				value : "bold,italic,underline,insertOrderedList,insertUnorderedList,align-left,justifyLeft,justifyCenter,justifyRight,insertImage,delete,redo,undo,foreColor,backColor,copy,cut,,fontName,fontSize,,indent,outdent,insertHorizontalRule,insertTable"
			},

			promptProcessors : {
				type : Object,
				value  : {}
			},

			undoState : {
				type : Array,
				value  : []
			},

			viewMode : {
				type : Number,
				value : 0,
				observer : "viewModeChanged"
			},

			value : {
				type : String,
				notify : true
			}
		},

		behaviors: [
			ir.ReflectToNativeBehavior,
			ir.SelectorBehavior
		],

		getInnerText : function(el)
		{
			return el.innerText;
		},

		setInnerText : function(el, text)
		{
			el.innerText = text;
		}
	})

	function replaceSelectionWithHtml(html) {
		// code by Tim Down http://stackoverflow.com/users/96100/tim-down
		var range, html;
		if (window.getSelection && window.getSelection().getRangeAt) {
			range = window.getSelection().getRangeAt(0);
			range.deleteContents();
			var div = document.createElement("div");
			div.innerHTML = html;
			var frag = document.createDocumentFragment(), child;
			while ( (child = div.firstChild) ) {
				frag.appendChild(child);
			}
			range.insertNode(frag);
		} else if (document.selection && document.selection.createRange) {
			range = document.selection.createRange();
			range.pasteHTML(html);
		}
	}
})();
