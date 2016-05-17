/*
	1.	CaretRules
	
		A small domain language for simple description of complex relationships
		between DOM nodes. 
	
		Born out of suffering of caret/range navigation complexity in contenteditable.
	
	2.	Expressions
	
		2.1 rule expressions:	
			a single rule is represented by a relationship of the form:

			RULE := [SYM1]<REL>[SYM2]
			
		2.2 ruleset expressions:
			a ruleset is a sequence of rules in a comma separated list, i.e.:
	
			RULESET := ([SYM11]<REL1>[SYM12],[SYM21]<REL2>[SYM22],...)
	
		2.3 node symbols [SYM]:
			*	 	- Anything including falsy values
			NODE	- Any node
			EDITOR 	- Editor
			IS 		- Custom Element
			CONT 	- Container - block level (non-inline) element that can contain text
			NCCONT 	- Container - block level (non-inline, non-custom) element that can contain text
			INLINE 	- Inline Elment
			TRANS 	- Transitional element (such as UL,TR,TABLE)
			BLOCK 	- Any block level non-custom element (CONT,INLINE,TRANS)
			CONTED 	- Content editable
			TEXT 	- Text node
			P 		- Paragraph
			PEMPTY 	- Empty paragraph
			CARET 	- Caret
			NCBLOCK - Non-container block (e. g. <BR>)
			
			Prospective (not implemented but could make sense for other uses):
			$DIV, $.BLUECLASS $#ELID, to autogenerate symbols as they occur
			
		2.4 relationship descriptors <REL>:
			*+[SYM1]			- node is 
			*-[SYM1]			- node is not
			[SYM1]|[SYM2] 		- ordered siblings
			[SYM1]|||[SYM2] 	- unordered siblings (effectively (<SYM1>|<SYM2> or <SYM2>|<SYM1>))
			[SYM1]>[SYM2] 		- immediate descendant e. g. ED>IS
			[SYM1]>>[SYM2] 		- NODE2 is descendant of NODE1
			
		2.5 negation
			both symbols and relationships may be negated by prefixing with `!`, such as:
			
			!CONT>!TEXT
			
			or even things that might look bizare at the first sight:
			
			!P!||!TEXT - which means not paragraph and not text which are not siblings. again, seems useless in contenteditable context, but who knows.

	3.	Defining and running rulesets

		3.1 
		
			Call ir.textarea.CaretRulesets(rulesDef, editor) with rulesDef object of the form:
		
				rulesDef = {
					ruleset1 : RULESET1,
					ruleset2 : RULESET2,
					...
				}
				
				and `editor` as the root node of the document we are interested in inspecting.
			
			where RULESET1, RULESET2, ... are strings as in 2.2

			The returned object will contain the same rulesets translated to functions, that may be called
			to run a ruleset on two nodes, like so:
			
				// define
				rules = ir.textarea.CaretRulesets(rulesDef, docment.getElementById('#editor'))
				
				// use
				rules.ruleset1(node1, node2)
			
			Running the ruleset will return an object of the form:
				
				{
					left : node1,
					right : node2,
					info : "[SYM1]<REL>[SYM2]" // the actual rule that matched
				}
			
			or a falsy value if no match occured.
*/



(function() {
	var utils = ir.textarea.utils;

	var CaretRulesets = 
	ir.textarea.CaretRulesets = 
	
	/* CaretRuleset constructor */
	function CaretRulesets(_caretRules, editor) {
		var caretRules = {}, rulesetCheckers = {};
		
		this.check = {};
		this.editor = editor;
		
		Object.keys(_caretRules).forEach(function(r) {
			caretRules[r] = this.parseRules(_caretRules[r]);
		}.bind(this));		
		
	
		Object.keys(caretRules).forEach(function(r) {
			this[r] = this._match.bind(this, caretRules[r]);
		}.bind(this));
		
		
		this.caretRules = caretRules;
	}
	
	/* parse a ruleset */
	CaretRulesets.prototype.parseRules = function(rulesText) {
		var tokens = rulesText.split(/\s*\,\s*/), t, rules = [], r;
		while(t = tokens.pop())
		{
			r = t.match(/(\!?[\w\*]+)(\!?[\+\-\>\|]{1,2})(\!?[\w\*]+)/);
			rules.push(new CaretRule(r[1],r[2],r[3], this.editor));
		}
		
		return rules;
	}

	/* run a pair of elements through a ruleset */
	CaretRulesets.prototype._match = function(rules, el1, el2) {
		var f;

		var i = -1, r;
		while(++i < rules.length)
		{
			r = rules[i].run(el1, el2);

			if(r)
				return r;
		}
			
		return false;
	}

	/* a single caret rule constructor */
	var CaretRule = function(_t1, _op, _t2, editor) {
		var t1, t2, op, f, info = _t1 + _op + _t2, 
			negleft, negright, negres, negrx = /^\!/; // primitive negation

		this.editor = editor;
			
		negleft = negrx.test(_t1)
		if(negleft) _t1 = _t1.replace(negrx, '');
		negright = /^\!/.test(_t2)
		if(negright) _t2 = _t2.replace(negrx, '');
		negres = /^\!/.test(_op)
		if(negres) _op = _op.replace(negrx, '');
		
		t1 = this.Symbols[_t1],
		t2 = this.Symbols[_t2],
		op = this.Relationships[_op];
		
		if(!t1) new Error(_t1 + ' is an unknown symbol');
		if(!t2) new Error(_t2 + ' is an unknown symbol');
		if(!op) new Error(_op + ' is an unknown operator');

		this.symleft = t1;
		this.symright = t2;
		this.op = op;
		this.opname = _op;
		this.negleft = negleft;
		this.negright = negright;
		this.negres = negres;
		this.info = info;
	}
	
	CaretRule.prototype.run = function(e1, e2, recursive) {
		var l, r, res;
		
		
		if(/[+-]/.test(this.opname))
			return this.op(e1, e2, this)
		
		// >| is agnostic to the given left
		if(this.opname == '>|')
			e1 = utils.parentNode(e2, this.editor);
		
		//console.log(info,negleft,_t1,negright,_t2,negres,op)
		l = this.symleft(e1);
		r = this.symright(e2);		
		
		// negation
		if(this.negleft) l = !l;		
		if(this.negright) r = !r;
		
		// >> is agnostic to the given left
		if(this.opname == '>>' && r)
			res = this.op(e1, e2, this) && this.info;
		else
		if(l && r)
			res = this.op(e1, e2, this) && this.info;
			
		if(this.negres)
			return res = !res;
		
		if(this.opname == '||' && !res && !recursive)
			return CaretRule.prototype.run.call(this, e2, e1, true)

		return res;
	};
	
	var Symbols = 
	ir.textarea.CaretRulesets.Symbols = 
	CaretRule.prototype.Symbols = {
		'*' :		function()	 { return true },
		NODE : 		function(el) { return el instanceof Node },
		EDITOR : 	function(el) { return el == editor },
		SHADOW :	function(el) { 
			return el && !utils.isInLightDom(el, this.editor); 
		},
		IS : 		function(el) { return el && el.is && el != this.editor },
		NULL : 		function(el) { return !el },
		CONT : 		function(el) { return utils.canHaveChildren(el) },
		
		// non-custom container
		NCCONT :	function(el) { return el && !el.is && utils.canHaveChildren(el) },
		
		// empty non-custom container
		NCCONTEMPTY : function(el) { return !el.is && utils.canHaveChildren(el) && (!el.firstChild || el.firstChild.tagName == 'BR')},
		INLINECONT: function(el) { return el && utils.isInlineElement(el) && utils.canHaveChildren(el) && !utils.isParagraph(el) },

		TRANS : 	function(el) { return utils.isTransitionalElement(el) }, // add more
		CONTED : 	function(el) { // also matches text node immediately under contenteditable
			var ce;
			if(!el)
				return;
			while(el.nodeType == 3 || Symbols.INLINECONT.call(this, el) || Symbols.NCBLOCK.call(this, el))
				 el = utils.parentNode(el, this.editor);
			if(el && el.getAttribute) 
				ce = el.getAttribute('contenteditable');
			return ce && ce != 'false' 
		},
		TEXT : 		function(el) { return el && el.nodeType == 3 },
		NBTEXT : 	function(el) { return el && el.nodeType == 3 && /\S/.test(el.textContent) },
		EMPTYTEXT : function(el) { return Symbols.TEXT.call(this, el) && /^\s*$/.test(el.textContent) },
		EMPTYCONT : function(el) { return Symbols.CONT.call(this, el) && (!el.childNodes.length || (utils.singleChildNode(el) && el.firstChild.tagName == "BR") )},
		P : 		function(el) { return utils.isParagraph(el) },
		PEMPTY : 	function(el) { return utils.isEmptyParagraph(el) },
		CARET : 	function(el) { return el && el.isCaret },
		NCBLOCK : 	function(el) { return el && el.nodeType == 1 && !utils.canHaveChildren(el) },
	}
		
	CaretRule.prototype.Relationships = {
		"+" : 	function(e1, e2, rule) { return rule.symright(e2) },
		"-" : 	function(e1, e2, rule) { return !rule.symright(e2) },
		"|" : 	function(e1, e2) { return e1.nextSibling == e2 },
		"||" : 	function(e1, e2) { return (e1 && e1.nextSibling == e2) || (e2 && e2.nextSibling == e1) },
		">" : 	function(e1, e2) { return e1 == utils.parentNode(e2) },
		">|" : 	function(e1, e2) { return utils.parentNode(e2, this.editor) == e1 },
		">>" : 	function(e1, e2, rule)  { 
											var t = e2, lr, done;
											
											if(!this.editor)
												throw new Error("No editor set");
											
											if(e2 == this.editor)
												return;
											
											while((t = utils.parentNode(t, this.editor)) && !done)
											{
												lr = rule.symleft(t);
												if(rule.negleft && !lr)
													return true;
												else
												if(lr)
													return true;
												
												done = t == this.editor
											}
											if(rule.negleft)
												return !lr;
											else
												return lr;
										}
	}

	
	return CaretRulesets;
})();