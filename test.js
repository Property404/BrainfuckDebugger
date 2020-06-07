import {TokenType, Debugger} from './Debugger.js';

function assert(claim, message)
{
	if (message == undefined)
		message = "<no message>";
	if(!claim)
	{
		throw("Assertion failed:" + message);
	}
}

function codifyString(str)
{
	let output="";
	for(const c of str)
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
		code:"+++[->++<]>>--->>++",
		expected_result:""
	},
	{
		code:"------- [+] +++",
		expected_result:""
	},
	{
		code:"+++++[-]+++",
		expected_result:""
	},
	{
		code:">++++++++[->-[->-[->-[-]<]<]<] ++++++++[<++++++++++>-]<[>+>+<<-]>-.>-----.>++++++++++.",
		expected_result:"OK\n"
	},
	{
		code:" >++++++++[-<+++++++++>]<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]>-----.>-> +++..+++.>-.<<+[>[+>+]>>]<--------------.>>.+++.------.--------.>+.>+.",
		expected_result:"Hello World!\n"
	},
	{
		code:"++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.",
		expected_result:"Hello World!\n"
	},
	{
		code:"++++++++++[>++++++++++<-]>>++++++++++>->>>>>>>>>>>>>>>>-->+++++++[->++ ++++++++<]>[->+>+>+>+<<<<]+++>>+++>>>++++++++[-<++++<++++<++++>>>]++++ +[-<++++<++++>>]>>-->++++++[->+++++++++++<]>[->+>+>+>+<<<<]+++++>>+>++ ++++>++++++>++++++++[-<++++<++++<++++>>>]++++++[-<+++<+++<+++>>>]>>--> ---+[-<+]-<[+[->+]-<<->>>+>[-]++[-->++]-->+++[---++[--<++]---->>-<+>[+ +++[----<++++]--[>]++[-->++]--<]>++[--+[-<+]->>[-]+++++[---->++++]-->[ ->+<]>>[.>]++[-->++]]-->+++]---+[-<+]->>-[+>>>+[-<+]->>>++++++++++<<[- >+>-[>+>>]>[+[-<+>]>+>>]<<<<<<]>>[-]>>>++++++++++<[->-[>+>>]>[+[-<+>]> +>>]<<<<<]>[-]>>[>++++++[-<++++++++>]<.<<+>+>[-]]<[<[->-<]++++++[->+++ +++++<]>.[-]]<<++++++[-<++++++++>]<.[-]<<[-<+>]+[-<+]->>]+[-]<<<.>>>+[ -<+]-<<]",
		expected_result:"1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n16\n17\nFizz\n19\nBuzz\nFizz\n22\n23\nFizz\nBuzz\n26\nFizz\n28\n29\nFizzBuzz\n31\n32\nFizz\n34\nBuzz\nFizz\n37\n38\nFizz\nBuzz\n41\nFizz\n43\n44\nFizzBuzz\n46\n47\nFizz\n49\nBuzz\nFizz\n52\n53\nFizz\nBuzz\n56\nFizz\n58\n59\nFizzBuzz\n61\n62\nFizz\n64\nBuzz\nFizz\n67\n68\nFizz\nBuzz\n71\nFizz\n73\n74\nFizzBuzz\n76\n77\nFizz\n79\nBuzz\nFizz\n82\n83\nFizz\nBuzz\n86\nFizz\n88\n89\nFizzBuzz\n91\n92\nFizz\n94\nBuzz\nFizz\n97\n98\nFizz\nBuzz\n"
	}
];

function basic_validation_test(optimize=true){
	for(const source of SOURCES)
	{
		const debug = new Debugger(source.code);
		debug.optimize = optimize;
		for(const token of debug.tokens)
		{
			if (token.partner)
			{
				let self_type = token.type;
				let partner_type = debug.tokens[token.partner].type;
				if(self_type == TokenType.BF_LOOP_CLOSE)
				{
					assert(partner_type ===TokenType.BF_LOOP_OPEN, "] should have [ as a partner");
				}
				else
				{
					assert(self_type == TokenType.BF_LOOP_OPEN, "Non-loop token has partner");
					assert(partner_type ===TokenType.BF_LOOP_CLOSE, "[ should have ] as a partner");
				}
			}
		}
	}
	return true;

}
function congruent_state_test(optimize=true){
	for(const source of SOURCES)
	{
		const debug = new Debugger(source.code);
		debug.optimize = optimize;

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
			assert(hash1===hash3, `hash1!==hash3 (pc:${debug.pc}, i:${i})`, debug);

			const hash4=debug.getStateHash();

			assert(hash2===hash4, "hash2!==hash4", debug);
		}

		assert(debug.getStateHash()===first_final_hash, "Final hash failed");
	}
	return true;
}
function two_steps_back_test(optimize=true){
	for(const source of ["+++++[->+.+<]>>>"])
	{
		const debug = new Debugger(source);
		debug.optimize = optimize;

		while(!debug.atEnd())
		{
			debug.step();
		}

		const first_final_hash = debug.getStateHash();

		while(debug.tokens[debug.pc].type !== TokenType.BF_OUTPUT)
		{
			debug.step(true);
		}

		while(!debug.atEnd())
		{
			debug.step();
		}
		assert(first_final_hash == debug.getStateHash(), "Failed after rewinding to middle");

		while(!debug.atBeginning())
		{
			debug.step(true);
		}
		for(let i=0;i<10;i++)
		{
			assert([0,undefined].includes(debug.tape[i]),
				"Tape was not cleared after rewinding("+debug.tape[i]+")");
		}

	}
	return true;
}

function rewind_test(optimize=true){
	const debug=new Debugger();
	debug.optimize = optimize;
	for(const source of SOURCES)
	{
		let output="";
		debug.load(source.code);

		assert(debug.source === source.code);
		assert(debug.pc === 0);
		assert(debug.pointer === 0);

		debug.output_callback = (val)=>{ output+=val; };

		let initial_hash = debug.getStateHash();

		while(!debug.atEnd())
		{
			debug.step();
		}

		let final_hash = debug.getStateHash();

		assert(output === source.expected_result, "Before rewind: expected output not matched");


		/* Rewind */
		while(!debug.atBeginning())
		{
			debug.step(true);
		}

		assert(debug.getStateHash() == initial_hash, "Initial hash is not the same");

		for(const token of debug.tokens)
		{
			if(token.pc_stack)
				assert(token.pc_stack.length===1, `Ended up with non-empy PC stack in ${token.character}(column:${token.column}): ${token.pc_stack} `);
		}

		output="";
		while(!debug.atEnd())
		{
			debug.step();
		}

		assert(output === source.expected_result, "After rewind: expected output not matched");

	}
	return true;
}

function pinpoint_test(optimize=true){
	const code = ">++<.>>+>-[+]++>++>+++[>[->+++<<+++>]<<]";
	const debug=new Debugger(code);
	debug.optimize = optimize;

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
		assert(debug.getStateHash() === initial_hash, "i: "+i+" pc:"+pc);
		for(let j=0;j<i;j++)
		{
			debug.step();
		}
	}
	return true;
}

function main()
{
	const tests =
	[
		basic_validation_test,
		pinpoint_test,
		rewind_test,
		congruent_state_test,
		two_steps_back_test,

		// Optimization disabled
		basic_validation_test.bind(null,false),
		pinpoint_test.bind(null,false),
		two_steps_back_test.bind(null,false),
	];
	for(const test of tests)
	{
		try{
			test();
			console.log(test.name + " PASSED");
		}catch(e){
			console.log(test.name + " FAILED");
			console.log(e);
			return -1;
		}
	}
	return 0;
}
process.exit(main());
