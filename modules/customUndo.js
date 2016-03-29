// custom undo engine

if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.CustomUndoEngine = (function() {
	var utils = window.ir.textarea.utils,
		DELIMITER = window.ir.textarea.utils.DELIMITER;
	
	var RangeMemo = function(root) {
		var r = utils.getSelectionRange(), sc, ec, so,eo,cps, cpe, lps, lpe, cn, n;

		this.root = root;

		if(!r)
			return;

		sc = r.startContainer;
		ec = r.endContainer;
		so = r.startOffset;
		eo = r.endOffset;

		if(r && sc.proxyTarget) // same name new animal
			sc = ec = sc.proxyTarget.nextSibling, so = eo = 0;
			
		if(!sc)
			return;

		if(sc.childNodes && sc.childNodes.length && sc.childNodes[so] && sc.childNodes[so].nodeType == 3)
		{
			sc = sc.childNodes[so];
			so = 0;
		}			
		if(ec.childNodes && ec.childNodes.length && ec.childNodes[eo] && ec.childNodes[eo].nodeType == 3)
		{
			ec = ec.childNodes[eo];
			eo = 0;
		}
		
		if(!utils.isDescendantOf(sc, root, true) || !utils.isDescendantOf(ec, root, true))
			return this.isOutOfRange = true;
	
		if(!sc || !ec)
			return this.isOutOfRange = true;
		
		if(!r || !utils.isDescendantOf(sc, root) || (sc != ec && !utils.isDescendantOf(ec, root)))
		{
			this.startPos = this.endPos = [];
			this.startOffset = this.endOffset = 0;

			return;
		}

		if(!utils.isDescendantOf(sc, root) || !utils.isDescendantOf(ec, root))
			return this.isOutOfRange = true;

		if(sc != root && !utils.isInLightDom(sc, root))
			sc = utils.getTopCustomElementAncestor(sc, root).nextSibling, so = 0;
		if(ec != root && !utils.isInLightDom(ec, root))
			ec = utils.getTopCustomElementAncestor(ec, root).nextSibling, eo = 0;

		this.delimitersBeforeStart = 0;
		
		if(!sc || !ec)
			return this.isOutOfRange = true;
		
		n = (sc.nodeType == 3 || sc.is) ? sc : sc.childNodes[so];
		n = n ? n.previousSibling : null;
		for(; n; n = n.previousSibling)
			this.delimitersBeforeStart += n.isDelimiter ? 1 : 0; //&& ((n.nextSibling && n.nextSibling.is) || (n.previousSibling && n.previousSibling.is)) ? 1 : 0;

		this.delimitersBeforeEnd = 0;
		n = (ec.nodeType == 3 || ec.is) ? ec : ec.childNodes[eo]
		n = n ? n.previousSibling : null;
		for(; n; n = n.previousSibling)
			this.delimitersBeforeEnd += n.isDelimiter ? 1 : 0; // && ((n.nextSibling && n.nextSibling.is) || (n.previousSibling && n.previousSibling.is)) ? 1 : 0;
		
		if(ec.isDelimiter) this.endIsDelimiter = true;
		
		cps = utils.getChildPathFromTop(sc, root);
		cpe = utils.getChildPathFromTop(ec, root);
				
		// non-normalized text nodes will become one after restore. not normalizing here because it's not undo's job
		for(n = sc.previousNode; n && n.nodeType == 3; n = n.previousNode)
			cps[cps.length - 1]--;
		
		for(n = ec.previousNode; n && n.nodeType == 3; n = n.previousNode)
			cpe[cpe.length - 1]--;
		

		if(sc.nodeType == 3 && sc.textContent.length == 0)
			this.startIsEmpty = true;

		this.startIsText == sc.nodeType == 3
		this.endIsText == ec.nodeType == 3
		
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
		
		c.delimitersBeforeStart = this.delimitersBeforeStart;
		c.delimitersBeforeEnd = this.delimitersBeforeEnd;

		c.startIsText = this.startIsText;
		c.endIsText = this.endIsText;
		
		return c;
	}
	RangeMemo.prototype.isEqual = function(domPathMemo) {
		var i;

		if(this.root != domPathMemo.root)
			return false;

		if(this.outOfRange != domPathMemo.outOfRange)
			return;
		
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
			sc, ec, n, delimiter;
		
		sc = utils.getChildFromPath(this.startPos, this.root, 1);
		ec = utils.getChildFromPath(this.endPos, this.root, 1);
		
		if(!sc || !ec)
			return null;

		n = sc.firstChild;
		
		for(; n; n = n.nextSibling)
			if(n.is)
			{
				if(!n.previousSibling || n.previousSibling.nodeType != 3)
					n.parentNode.insertBefore(delimiter = document.createTextNode(DELIMITER), n);

				if(!n.nextSibling)
					n.parentNode.appendChild(delimiter = document.createTextNode(DELIMITER), n);
				else
				if(n.nextSibling.nodeType != 3)
					n.parentNode.insertBefore(delimiter = document.createTextNode(DELIMITER), n.nextSibling);
				
				if(delimiter) delimiter.isDelimiter;
				delimiter = null;
			}
		
		// console.log('%s delimiters, pos without:', this.delimitersBeforeStart, this.startPos[this.startPos.length-1]);

		this.startPos.push(this.startPos.pop() + this.delimitersBeforeStart);
		this.endPos.push(this.endPos.pop() + this.delimitersBeforeEnd);
		
		sc = utils.getChildFromPath(this.startPos, this.root);
		ec = utils.getChildFromPath(this.endPos, this.root);
		
		if(!sc || !ec || sc.is || ec.is)
			return null; // there probably was a previous, better range
		
		r.setStart(sc, this.startOffset);
		r.setEnd(ec, this.endOffset);
		
		if(doSetCaret)
		{
			s.removeAllRanges();
			s.addRange(r);
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
			this.rangeHistory = prevUndoItem.rangeHistory.map(function(rm) { return rm.clone(); });

		if(!this.rangeHistory.length)
			this.rangeHistory = [ new UndoItem(root) ];
	}

	UndoItem.prototype.updateRange = function() {
		var rm = new RangeMemo(this.root);

		if(rm.isOutOfRange)
			return;

		// skip accidential 0 positions when rangeHistory already contains some other location.
		if(this.rangeHistory.length && (rm.startOffset == 0 && !rm.startPos.length || rm.startIsEmpty))
//			(r.startPos.length == 1 && r.startPos[0] == 0 ))
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





	 var CustomUndoEngine = function(editor, options)  {
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

				prevUndo = undoRecord.length && undoRecord[undoRecord.length - 1];

				if(prevUndo && prevUndo.content == innerHTML)
					onlyUpdateRangeMemo = true;

				while(undoRecord.length >= options.maxUndoItems)
					undoRecord.shift();

				if(prevUndo && onlyUpdateRangeMemo)
				{
					prevUndo.updateRange();
					lastRestoredStateContent = null;
				}
				else
					undoRecord.push(new UndoItem(editor, innerHTML, prevUndo));

				// console.log(undoRecord.length, redoRecord.length);

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
		
		return CustomUndoEngine
	})();
