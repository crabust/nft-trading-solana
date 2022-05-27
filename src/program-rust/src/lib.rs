
pub mod error;
pub mod instruction;
pub mod processor;
pub mod state;
pub mod types;

use solana_program::{
    account_info::{AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    processor::Processor::process(program_id, accounts, _instruction_data)
}
