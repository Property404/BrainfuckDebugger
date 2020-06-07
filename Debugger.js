"use strict";
const DEFAULT_CELL_WIDTH = 256;

export const TokenType = Object.freeze({
	// Standard Brainfuck commands
	"BF_LOOP_OPEN": 1,
	"BF_LOOP_CLOSE":2,
	"BF_ADD": 3,
	"BF_SHIFT": 4,
	"BF_OUTPUT": 5,
	"BF_INPUT": 6,

	// Represents a [-] like construct
	// Automatically brings the value the pointer is pointing to to zero
	"BF_ZERO": 7,

	// Cushioning for the beginning and end of the token array
	"BF_START": 8,
	"BF_END": 9,
});

// Adapted from Property404/dbfi/src/interpret.c
// See original source for helpful comments or lack thereof
function tokenize(source, optimize=true)
{
	let line_number = 0;
	let column = 0;
	let token_index = 0;

	const tokens = [];
	const skip_stack = [];

	for(let i=0;i<source.length;i++)
	{
		const character = source[i];

		if("+-<>[].,".includes(character))
		{
			const new_token = {type:null, value:1, start:i, line:line_number, column: column};

			new_token.character=character;
			switch(character)
			{
				case "[":
					// Optimize out [-] and [+] into one token
					if(optimize && (source[i+1] === "-" || source[i+1] === "+") && source[i+2] === "]")
					{
						new_token.type=TokenType.BF_ZERO;
						new_token.value_stack = [];
						new_token.is_positive = (source[i+1]==='+')
						i+=2;
						column+=2;
					}
					else
					{
						new_token.type = TokenType.BF_LOOP_OPEN;
						skip_stack.push(token_index);
						new_token.pc_stack = [];
					}
					break;
				case "]":
					new_token.type = TokenType.BF_LOOP_CLOSE;
					new_token.pc_stack = [];
					// [ and ] need to be mated
					new_token.partner = skip_stack.pop();
					if(
						new_token.partner === undefined
					)
					{
						throw(`Unmatched ']' at line ${line_number+1} column ${column+1}`);
					}
					tokens[new_token.partner].partner = token_index;
					break;

				case '-':
				case '+':
					new_token.type=TokenType.BF_ADD;
					new_token.value=(character=='+'?1:-1);
					break;

				case '<':
				case '>':
					new_token.type=TokenType.BF_SHIFT;
					new_token.value=(character=='>'?1:-1);
					break;

				case '.':
					new_token.type = TokenType.BF_OUTPUT;
					break;

				case ',':
					new_token.type = TokenType.BF_INPUT;
					new_token.value_stack = [];
					break;

				default:
					break;
			}

			// Potentially condense series of <<<< >>>> ++++ or ----
			if(optimize && token_index > 0 && new_token.type == tokens[tokens.length - 1].type &&
				[TokenType.BF_SHIFT,TokenType.BF_ADD].indexOf(new_token.type) != -1)
			{
				tokens[tokens.length -1].value += new_token.value;
			}
			else
			{
				tokens.push(new_token);
				token_index++;
			}
		}
		if(character === "\n")
		{
			line_number++;
			column=-1;
		}
		column++;
	}
	tokens.unshift({type:TokenType.BF_START,value:0});
	tokens.push({type:TokenType.BF_END});

	// Since we added a token at beginning, we have to shift now
	for(const index in tokens)
	{
		if(tokens[index].partner)
		{
			tokens[index].partner += 1;
		}
	}
	return tokens;
}

export class Debugger
{
	constructor(source)	
	{
		if(source)
			this.load(source);

		this.output_callback = (val)=>{};
		this.input_callback = ()=>{return 0;};

		this.cell_width = DEFAULT_CELL_WIDTH;
		this.optimize=true;
		this.allow_wrapping = true;
		this.allow_negative_pointer = false;
	}

	load(source){
		this.source = source;
		this.tokens = tokenize(source, this.optimize);
		this.tape = {"0":0};
		this.reset();
	}

	getPositionInSource()
	{
		const res = this.tokens[this.pc].start;
		if (res === undefined)
			return -1;
		return res;
	}

	// Get a unique-ish integer valued tied to our current state
	getStateHash()
	{
		let total = 0;
		for (let i=0;i<1000;i++)
		{
			if(this.tape[i])
				total+=this.tape[i];
		}
		total += this.pointer * 100000;
		let pcval = this.tokens[this.pc].type;
		total += 1000*pcval;
		return total;
	}

	atEnd()
	{
		if(!this.tokens)return false;
		return this.pc >= this.tokens.length || this.tokens[this.pc].type==TokenType.BF_END;
	}
	
	atBeginning()
	{
		if(!this.tokens)return true;
		return this.pc == 0;
	}

	reset()
	{
		this.last_pc=0;
		this.pc = 0;
		this.pointer=0;
		for(const i in this.tape)
		{
			this.tape[i] = 0;
		}
		for (const token of this.tokens)
		{
			if(token.value_stack)
				token.value_stack.length = 0;
			if(token.pc_stack !== undefined)
			{
				token.pc_stack.length = 0;
				token.pc_stack.push(0);
			}
		}
	}

	step(reverse=false)
	{
		let stepagain = false;
		if(reverse)
			this.pc --;

		let pc_going_forth = this.pc;

		if(this.pc<0 || this.pc>this.tokens.length)
		{
			throw("Program counter out of bounds (pc = "+this.pc+")");
		}
		
		const token = this.tokens[this.pc];

		if (this.tape[this.pointer] == undefined)
			this.tape[this.pointer] = 0;

		if(token == undefined)
		{
			throw "Found undefined token";
		}
		switch(token.type)
		{
			case TokenType.BF_ZERO:
				if(reverse)
				{
					this.tape[this.pointer] = token.value_stack.pop();
				}
				else
				{
					token.value_stack.push(this.tape[this.pointer]);
					if(this.tape[this.pointer] && !this.allow_wrapping && token.is_positive)
					{
						throw("[+]-type construct throws cell value out of bounds");
					}
					this.tape[this.pointer] = 0;
				}
				break;

			case TokenType.BF_ADD:
				if(reverse)
					this.tape[this.pointer]-=token.value;
				else
					this.tape[this.pointer]+=token.value;

				if
				(
					this.tape[this.pointer] < 0 ||
					this.tape[this.pointer] >= this.cell_width
				)
				{
					if(!this.allow_wrapping)throw("Cell value out of bounds");

					this.tape[this.pointer]%=this.cell_width;
					if(this.tape[this.pointer] < 0)
						this.tape[this.pointer] = this.cell_width+this.tape[this.pointer];
				}
				break;
			case TokenType.BF_SHIFT:
				if(reverse)
					this.pointer-=token.value;
				else
					this.pointer+=token.value;
				if(this.pointer<0 && !this.allow_negative_pointer)
					throw(`Pointer out of bounds(pointer=${this.pointer}, direction=${reverse?"reverse":"forward"}) at line ${token.line+1} column ${token.column+1}`);
				break;
			case TokenType.BF_INPUT:
				if(!reverse)
				{
					const old_val  = this.tape[this.pointer];
					const new_val  = this.input_callback(); 
					if(new_val === null)
					{
						// Effectively do nothing, not even move PC
						// This is to allow controller.js to get input from user
						return;
					}
					else if(Number.isInteger(new_val))
					{
						this.tape[this.pointer] = new_val;
						token.value_stack.push(old_val);
					}
					else
					{
						throw "Debugger expected integer input(eg an ASCII value) but got: "+new_val;
					}
				}
				else
				{
					this.tape[this.pointer] = token.value_stack.pop();
				}
				break;
			case TokenType.BF_OUTPUT:
				if (!reverse)
				{
					const val = this.tape[this.pointer];
					const ch = String.fromCharCode(val);

					this.output_callback(ch);
				}
				break;

			case TokenType.BF_LOOP_OPEN:
			case TokenType.BF_LOOP_CLOSE:
				if(!reverse)
				{
					token.pc_stack.push(this.last_pc+1);

					if
					(
						(token.type === TokenType.BF_LOOP_CLOSE && this.tape[this.pointer])||
						(token.type === TokenType.BF_LOOP_OPEN && !this.tape[this.pointer])
					)
					{
						this.tokens[token.partner].pc_stack.push(this.pc);
						this.pc = token.partner;
					}
				}
				else
				{
					this.pc = token.pc_stack.pop();
					if(this.pc == token.partner)
					{
						this.tokens[token.partner].pc_stack.pop();
					}
				}
				break;
			case TokenType.BF_START:
			case TokenType.BF_END:
				break;
			default:
				throw "Found unknown token";
		}

		if(!reverse)
		{
			this.pc ++;
			if(this.pc>=this.tokens.length)
			{
				throw("Program counter out of bounds (pc = "+this.pc+")");
			}
		}

		this.last_pc = pc_going_forth;

		if(stepagain)
			this.step(reverse);
	}

	get current_value()
	{
		return this.tape[this.pointer];
	}
	set current_value(val)
	{
		this.tape[this.pointer] = val;
	}
}
