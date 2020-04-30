import {TokenType, Debugger} from './Debugger.js';
function assert(claim, message, object)
{
	if (message == undefined)
		message = "<no message>";
	if(!claim)
	{
		console.log("--ASSERTION FAILED--");
		if(object)
			object.displayTape();
		console.log("Assertion failed:" + message);
	return true;
	}
	return false;
}
function test(func)
{
	if(func())
		console.log(func.name + " PASSED");
	else
		console.log(func.name + " FAILED");
}
function codifyString(str)
{
	let output="";
	for(let c of str)
	{
		if(c.charCodeAt(0) < 33)
		{
			output+="<"+c.charCodeAt(0)+">";
		}
		else
		{
			output+=c;
		}
	}
	return output;

}
const SOURCES = [
	{
		code:"------- [+] +++",
		expected_result:""
	},
	{
		code:"+++++[-]+++",
		expected_result:""
	},
	{
		code:"+++[->++<]>>--->>++",
		expected_result:""
	},
	{
		code:"++++++++[->-[->-[->-[-]<]<]<] ++++++++[<++++++++++>-]<[>+>+<<-]>-.>-----.>++++++++++.",
		expected_result:"OK\n"
	},
	{
		code:" >++++++++[-<+++++++++>]<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]>-----.>-> +++..+++.>-.<<+[>[+>+]>>]<--------------.>>.+++.------.--------.>+.>+.",
		expected_result:"Hello World!\n"
	},
	{
		code:"++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.",
		expected_result:"Hello World!\n"
	}
];

function basic_validation_test(){
	for(let source of SOURCES)
	{
		let debug = new Debugger(source.code);
		for(let token of debug.tokens)
		{
			if (token.partner)
			{
				let self_type = token.type;
				let partner_type = debug.tokens[token.partner].type;
				if(self_type == TokenType.BF_LOOP_CLOSE)
				{
					if(assert(partner_type ===TokenType.BF_LOOP_OPEN, "] should have [ as a partner"))return false;
				}
				else
				{
					if(assert(self_type == TokenType.BF_LOOP_OPEN, "Non-loop token has partner"))return false;
					if(assert(partner_type ===TokenType.BF_LOOP_CLOSE, "[ should have ] as a partner"))return false;
				}
			}
		}
	}
	return true;

}
function congruent_state_test(){
	for(let source of SOURCES)
	{
		let debug = new Debugger(source.code);

		let output = "";
		debug.output_callback = (val)=>{output+=val;};

		while(!debug.atEnd())
		{
			debug.step();
		}

		assert(output==source.expected_result);


		const first_final_hash = debug.getStateHash();
		debug.reset();

		for(let i=0;!debug.atEnd();i++)
		{
			const hash1=debug.getStateHash();
			debug.step();

			const hash2=debug.getStateHash();
			debug.step(true);

			const hash3=debug.getStateHash();
			debug.step();

			const hash4=debug.getStateHash();

			if(assert(hash1===hash3, "hash1!==hash3", debug))return false;
			if(assert(hash2===hash4, "hash2!==hash4", debug))return false;
		}

		if(assert(debug.getStateHash()===first_final_hash, "Final hash failed"))return false;
	}
	return true;
}

function rewind_test(){
	let debug=new Debugger();
	for(let source of SOURCES)
	{
		let output="";
		debug.load(source.code);

		if(assert(debug.source === source.code))return false;
		if(assert(debug.pc === 0))return false;
		if(assert(debug.pointer === 0))return false;

		debug.output_callback = (val)=>{ output+=val; };

		let initial_hash = debug.getStateHash();

		while(!debug.atEnd())
		{
			debug.step();
		}

		let final_hash = debug.getStateHash();

		if(assert(output === source.expected_result, "Before rewind: expected output not matched"))return false;


		/* Rewind */
		while(!debug.atBeginning())
		{
			debug.step(true);
		}

		if(assert(debug.getStateHash() == initial_hash, "Initial hash is not the same"))return false;

		output="";
		while(!debug.atEnd())
		{
			debug.step();
		}

		if(assert(output === source.expected_result, "After rewind: expected output not matched"))return false;
	}
	return true;
}

function pinpoint_test(){
	let code = ">++<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]";
	code = ">>>>>>+>+>+[[->+<]<]";
	let debug=new Debugger(code);

	let i=0;
	let initial_hash = debug.getStateHash();
	while(!debug.atEnd())
	{
		debug.step();
		i++;
		let pc = debug.pc;
		for(let j=0;j<i;j++)
		{
			debug.step(true);
		}
		if(assert(debug.getStateHash() === initial_hash, "i: "+i+" pc:"+pc))return false;
		for(let j=0;j<i;j++)
		{
			debug.step();
		}
	}
	return true;
}

test(basic_validation_test);
test(congruent_state_test);
test(rewind_test);
test(pinpoint_test);
