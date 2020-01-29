"use strict";
const CELL_WIDTH = 256;


const TokenType = Object.freeze({
	"BF_LOOP_OPEN":1,
	"BF_LOOP_CLOSE":2,
	"BF_ADD":3,
	"BF_SHIFT":4,
	"BF_OUTPUT":5,
	"BF_INPUT":6,
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
		let character = source[i];
		if("+-<>[].,".includes(character))
		{
			let new_token = {type:null, value:1};

			switch(character)
			{
				case "[":
					new_token.type = TokenType.BF_LOOP_OPEN;
					skip_stack.push(token_index);
					// Empty pass stack for reverse debugging
					new_token.pass_stack = [];
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
	return tokens;
}

class Debugger
{
	constructor(source)	
	{
		this.source = source;
		this.tokens = tokenize(source, true);
		this.pc = 0; // Program pointer/counter
		this.pointer = 0; // Data pointer
		this.tape = {"0":0};
		console.log(this.tokens.length);
	}

	finished()
	{
		return this.pc >= this.tokens.length;
	}

	step(reverse=false)
	{
		if(reverse)
			this.pc --;
		
		const token = this.tokens[this.pc];

		if (this.tape[this.pointer] == undefined)
			this.tape[this.pointer] = 0;

		switch(token.type)
		{
			case TokenType.BF_ADD:
				if(reverse)
					this.tape[this.pointer]-=token.value;
				else
					this.tape[this.pointer]+=token.value;

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
				process.stdout.write(String.fromCharCode(this.tape[this.pointer]));
				break;
			case TokenType.BF_LOOP_OPEN:

				if(!reverse)
				{
					// Jump to matching ] if false (zero)
					if(!this.tape[this.pointer])
					{
						this.pc = token.partner;
					}
					else
					{
						// Otherwise we just pass by and push something onto the pass stack
						token.pass_stack.push(1);
					
						// Optimize out the [-] pattern
						if(token.partner == this.pc+2 && this.tokens[this.pc+1].type === '-')
						{
							this.tape[this.pointer] = 0;
							this.pc = token.partner;
						}
					}
				}
				else
				{
					// Pass <-- if pass stack empty
					// Otherwise pop and go to matching ]
					if (token.pass_stack.length == 0)
					{
						token.pass_stack.pop(1);
						
						// Shouldn't matter if we jump to or past since
						// ] on reverse does effectively nothing
						this.pc = token.partner;
					}
				}
				break;
			case TokenType.BF_LOOP_CLOSE:
				if(!reverse)
					this.pc = token.partner - 1;
				break;
		}

		if(!reverse)
			this.pc ++;
	}
}


const source = " >++++++++[-<+++++++++>]<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]>-----.>-> +++..+++.>-.<<+[>[+>+]>>]<--------------.>>.+++.------.--------.>+.>+."
let debug = new Debugger(source);
while(! debug.finished())
{
	debug.step();
}
const times = 76
for(let i=0;i<times;i++)
{
	debug.step(true);
}
for(let i=0;i<times;i++)
{
	debug.step(false);
}
