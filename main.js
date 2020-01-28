// Adapted from Property404/dbfi/src/interpret.c
// See original source for helpful comments or lack thereof
function tokenize(source)
{
	let byte_index = 0;
	let line_index = 0;
	let token_index = 0;

	let tokens = [];
	let skip_stack = [];

	for(let character of source)
	{
		if("+-<>[].,".includes(character))
		{
			let new_token = {type:character};

			switch(character)
			{
				case "[":
					skip_stack.push(token_index);
					break;
				case "]":
					// [ and ] need to be mated
					new_token.partner = skip_stack.pop();
					tokens[new_token.partner].partner = token_index;
					break;
				default:
					break;
			}

			tokens.push(new_token);
			token_index++;
		}
		else if(character == "\n")
		{
			line_index++;
		}
		byte_index++;
	}
	return tokens;
}

function interpret(tokens)
{
	let tape = {"0":0};
	let pointer = 0;

	for(i=0;i<tokens.length;i++)
	{
		let token = tokens[i];

		if (tape[pointer] == undefined)
			tape[pointer] = 0;

		switch(token.type)
		{
			case '+':
				tape[pointer]++;
				break;
			case '-':
				tape[pointer]--;
				break;
			case '>':
				pointer++;
				break;
			case '<':
				pointer --;
				break;
			case '.':
				console.log(String.fromCharCode(tape[pointer]));
				break;
			case '[':
				if(!tape[pointer])
				{
					i = token.partner;
				}
				break;
			case ']':
				i = token.partner - 1;
				break;
		}
	}
}

const source = " >++++++++[-<+++++++++>]<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]>-----.>-> +++..+++.>-.<<+[>[+>+]>>]<--------------.>>.+++.------.--------.>+.>+.  "
let toks = tokenize(source);
interpret(toks);




