use thiserror::Error;

use solana_program::program_error::ProgramError;

#[derive(Error, Debug, Copy, Clone)]
pub enum NFTError {
    /// Invalid authority
    #[error("Invalid Authority")]
    InvalidAuthority,

    /// Invalid instruction data
    #[error("Invalid Instruction Data")]
    InvalidInstructionData,

    /// Invalid platform fee
    #[error("Invalid Platform Fee")]
    InvalidPlatformFee,

    /// Invalid instruction
    #[error("Invalid Instruction")]
    InvalidInstruction,
    
    /// Failed to unpack U64
    #[error("Failed to unpack U64")]
    FailedToUnpackU64,
}

impl From<NFTError> for ProgramError {
    fn from(e: NFTError) -> Self {
        ProgramError::Custom(e as u32)
    }
}