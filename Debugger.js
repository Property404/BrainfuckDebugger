"use strict";
const CELL_WIDTH = 256;


const TokenType = Object.freeze({
	"BF_LOOP_OPEN":1,
	"BF_LOOP_CLOSE":2,
	"BF_ADD":3,
	"BF_SHIFT":4,
	"BF_OUTPUT":5,
	"BF_INPUT":6,
	"BF_ZERO":7,
	"BF_END":8
})

// Adapted from Property404/dbfi/src/interpret.c
// See original source for helpful comments or lack thereof
function tokenize(source, optimize=true)
{
	let byte_index = 0;
	let line_index = 0;
	let token_index = 0;

	let tokens = [];
	let skip_stack = [];

	for(let i=0;i<source.length;i++)
	{
		const character = source[i];

		if("+-<>[].,".includes(character))
		{
			let new_token = {type:null, value:1, start:i};

			new_token.character=character;
			switch(character)
			{
				case "[":
					if(optimize && source[i+1] === "-" && source[i+2] === "]")
					{
						new_token.type=TokenType.BF_ZERO;
						new_token.value_stack = [];
						i+=2;
					}
					else
					{
						new_token.type = TokenType.BF_LOOP_OPEN;
						skip_stack.push(token_index);
						// Empty pass stack for reverse debugging
						new_token.pass_stack = [];
						new_token.in_progress = false;
					}
					break;
				case "]":
					new_token.type = TokenType.BF_LOOP_CLOSE;
					// [ and ] need to be mated
					new_token.partner = skip_stack.pop();
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
		else if(character == "\n")
		{
			line_index++;
		}
		byte_index++;
	}
	tokens.push({type:TokenType.BF_END});
	return tokens;
};

export default class Debugger
{
	constructor(source)	
	{
		if(source)
			this.load(source);

		this.output_callback = (val)=>{};
		this.input_callback = ()=>{return 0;};
	}

	load(source){
		this.source = source;
		this.tokens = tokenize(source, true);
		this.tape = {"0":0};
		this.pc = 0; // Program pointer/counter
		this.pointer = 0; // Data pointer
		this.reset();
	}

	getPositionInSource()
	{
		let res = this.tokens[this.pc].start;
		if (res === undefined)
			return -1;
		return res;
	}

	displayTape()
	{
		for(let i=0;i<30;i++)
		{
			if(this.tape[i] == undefined)
				this.tape[i] = 0;
			process.stdout.write("|"+this.tape[i]);
		}
		console.log("| ***"+this.pc+"("+this.tokens[this.pc].character+")***"+this.getStateHash());
		for(let i=0;i<10;i++)
		{
			if(i==this.pointer)
				process.stdout.write(" ^");
			else
				process.stdout.write("  ");
		}
		console.log("");

	}
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
		if (pcval === TokenType.BF_LOOP_CLOSE)
		{
			pcval = TokenType.BF_LOOP_OPEN;
		}
		total += 1000*pcval;
		return total;
	}

	atEnd()
	{
		return this.pc >= this.tokens.length || this.tokens[this.pc].type==TokenType.BF_END;
	}
	
	atBeginning()
	{
		return this.pc == 0;
	}

	reset()
	{
		this.pc = 0;
		this.pointer=0;
		for(let i in this.tape)
		{
			this.tape[i] = 0;
		}
		for (let token of this.tokens)
		{
			token.pass_stack = [];
			token.in_progress = false;
		}
	}

	step(reverse=false)
	{
		let stepagain = false;
		if(reverse)
			this.pc --;
		
		const token = this.tokens[this.pc];

		if (this.tape[this.pointer] == undefined)
			this.tape[this.pointer] = 0;

		if(token == undefined)
		{
			console.err("Undefined Token");
			console.err("pc="+this.pc);
			console.err("pointer="+this.pointer);
			return
		}
		switch(token.type)
		{
			case TokenType.BF_ZERO:
				if(reverse)
				{
					this.tape[this.pointer] = token.value_stack.pop();
					if (this.tape[this.pointer] == null)
					{
						throw "Oh my gooooood";
					}
				}
				else
				{
					token.value_stack.push(this.tape[this.pointer]);
					this.tape[this.pointer] = 0;
				}
				break;

			case TokenType.BF_ADD:
				if(reverse)
					this.tape[this.pointer]-=token.value;
				else
					this.tape[this.pointer]+=token.value;

				if (this.tape[this.pointer]<0 || this.tape[this.pointer]>255)
				{
					//console.log("OVERFLOW");
				}
				this.tape[this.pointer]%=CELL_WIDTH;
				if(this.tape[this.pointer] < 0)
					this.tape[this.pointer] = CELL_WIDTH+this.tape[this.pointer];
				break;
			case TokenType.BF_SHIFT:
				if(reverse)
					this.pointer-=token.value;
				else
					this.pointer+=token.value;
				break;
			case TokenType.BF_OUTPUT:
				if (!reverse)
				{
					let val = this.tape[this.pointer];
					let ch = String.fromCharCode(val);

					this.output_callback(ch);
				}
				break;
			case TokenType.BF_LOOP_OPEN:
				if(!reverse)
				{
					if(this.tape[this.pointer])
					{
						if(!token.in_progress)
							token.pass_stack.push(0);
						token.in_progress = true;
						token.pass_stack[token.pass_stack.length-1]++;
					}
					else
					{
						token.in_progress = false;
						// Otherwise we just pass by 
						this.pc = token.partner;
					}
				}
				else
				{
					if(token.pass_stack.slice(-1)[0]>token.in_progress)
					{
						token.pass_stack[token.pass_stack.length-1]--;
						this.pc = token.partner;
						//token.in_progress = false;
					}
					else
					{
						token.pass_stack.pop();
						token.in_progress = false;
					}
				}
				break;
			case TokenType.BF_LOOP_CLOSE:
				if(!reverse)
				{
					this.pc = token.partner-1;
					stepagain = true;
				}
				else
				{
					this.pc = token.partner+1;
					stepagain = true;
				}
				break;
			case TokenType.BF_END:
				break;
			default:
				console.log("Unknown token: "+token);
				break;
		}

		if(!reverse)
			this.pc ++;

		if(stepagain)
			this.step(reverse);
	}
}


/*
const source = 
		" ++++++++[->-[->-[->-[-]<]<]<] ++++++++[<++++++++++>-]<[>+>+<<-]>-.>-----.>++++++++++.";
let debug = new Debugger(source);

for(let i=0;!debug.atEnd();i++)
{
	debug.step();
}
console.log("finished.")
*/
