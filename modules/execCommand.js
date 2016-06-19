// execCommand polyfill
// 
// for details see https://developer.mozilla.org/en/docs/Web/API/Document/execCommand
//

if(!window.ir) window.ir = {};
if(!window.ir.textarea) window.ir.textarea = {};

window.ir.textarea.execCommand = 
(function() {
	var 
	
	extract = ir.textarea.extract,
	wrap = ir.textarea.wrap,
	commandMap, execCommand,
	fontSizeMap;
	
	fontSizeMap = "xx-small,x-small,small,medium,large,x-large,xx-large".split(','); // maps medium to 3 which is the default
	
	
	commandMap = {
		"backColor" : function(range, cssColor, top) {
			return wrap.wrapWithAttributes(range, 'span', { style : { color : cssColor } }, top);
		},
		"bold" : function(range, top) {
			return wrap.wrapWithAttributes(range, 'b', null, top);
		},
		"copy" : function(range, top) {
			return extract.extractContents(range.startPos, range.endPos, { top : top });
		},
		"createLink" : function(range, href, top) {
			return wrap.wrapWithAttributes(range, 'a', { href : href }, top);
		},
		"createLink" : function(range, href, top) {
			return wrap.wrapWithAttributes(range, 'a', { href : href }, top);
		},
		"cut" : function(range, top) {
			return extractContents(range.startPos, range.endPos, { top : top, delete : true });
		},
		"decreaseFontSize" : function(range, top)
		{
			return wrap.wrapWithAttributes(range, 'small', null, top);
		},
		"delete" : function(range, top) {
			return extractContents(range.startPos, range.endPos, { top : top, delete : true });
		},
		// skipped: 
		// {
		// "cmd": "enableInlineTableEditing",
		// "desc": "Enables or disables the table row and column insertion and deletion controls. (Not supported by Internet Explorer.)"
		// }, {
		// 	"cmd": "enableObjectResizing",
		// 	"desc": "Enables or disables the resize handles on images and other resizable objects. (Not supported by Internet Explorer.)"
		// }
		"fontName" : function(range, fontFamily, top) {
			return wrap.wrapWithAttributes(range, 'span', { style : { fontFamily : fontFamily } }, top);
		},
		"fontSize" : function(range, fontSize, top) {
			return wrap.wrapWithAttributes(range, 'span', { style : { fontSize : fontSizeMap[fontSize] } }, top);
		},
		"foreColor" : function(range, color, top) {
			return wrap.wrapWithAttributes(range, 'span', { style : { color : color } }, top);
		},
		// skipped :
		// {
		// "cmd": "formatBlock",
		// "desc": "Adds an HTML block-style tag around the line containing the current selection, replacing the block element containing the line if one exists (in Firefox, BLOCKQUOTE is the exception - it will wrap any containing block element). Requires a tag-name string to be passed in as a value argument. Virtually all block style tags can be used (eg. \"H1\", \"P\", \"DL\", \"BLOCKQUOTE\"). (Internet Explorer supports only heading tags H1 - H6, ADDRESS, and PRE, which must also include the tag delimiters < >, such as \"<H1>\".)"
		//},
		
		// alias for backColor
		"hiliteColor" :function(range, cssColor, top) {
			return commandMap.backColor.call(cssColor, arguments);
		},
		
		"increaseFontSize" : function(range, top)
		{
			return wrap.wrapWithAttributes(range, 'big', null, top);
		},
		"indent" : function(range, top){
				return w.wrapIndent({ startPosition : s, endPosition : e }, false, editor)
		},
		"outdent" : function(range, top){
			return w.wrapIndent({ startPosition : s, endPosition : e }, true, editor)
		},
		
		// skipped :
		// paste, redo, removeFormat, selectAll,
		"strikeThrough" : function(range, top) {
			return wrap.wrapWithAttributes(range, 's', null, top);
		},
		"subscript" : function(range, top) {
			return wrap.wrapWithAttributes(range, 'sub', null, top);
		},
		"subscript" : function(range, top) {
			return wrap.wrapWithAttributes(range, 'sub', null, top);
		},
		"supercript" : function(range, top) {
			return wrap.wrapWithAttributes(range, 'sup', null, top);
		},
		// skipped:
		// tableCreate
		"underline" : function(range, top) {
			return wrap.wrapWithAttributes(range, 'u', null, top);
		},
		// skipped: undo
		"unlink" : function() {
			return wrap.wrapWithAttributes(range, 'a', null, top);
		}
		// skipped: useCSS, styleWithCSS
		
	}

	return function(range, aCommandName, aShowDefaultUI, aValueArgument) {
		commandMap[aCommandName](aValueArgument);
	};
})();