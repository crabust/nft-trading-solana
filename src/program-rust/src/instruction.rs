use std::convert::{TryInto};
use solana_program::{
    program_error::ProgramError,
    pubkey::Pubkey,
    msg
};
use arrayref::{array_ref};
use crate::error::NFTError;

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct Initialize {
    pub authority: Pubkey,
    pub platform_fee: u64
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct ChangeAuthority {
    pub authority: Pubkey
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct ChangeFee {
    pub platform_fee: u64
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct List {
    pub amount: u64,
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct DeList {
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct Bid {
    pub amount: u64
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct WithdrawBid {
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct AcceptBid {
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct WithdrawNFTOnSuccess {
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub struct RefundUser {
}

#[repr(C)]
#[derive(Debug, PartialEq)]
pub enum NFTInstruction {
    Initialize(Initialize),
    ChangeAuthority(ChangeAuthority),
    ChangeFee(ChangeFee),
    List(List),
    DeList(DeList),
    Bid(Bid),
    WithdrawBid(WithdrawBid),
    AcceptBid(AcceptBid),
    WithdrawNFTOnSuccess(WithdrawNFTOnSuccess),
    RefundUser(RefundUser)
}

impl NFTInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input.split_first().ok_or(NFTError::InvalidInstruction)?;
        match tag {
            0 => {
                if rest.len() < 32usize {
                    return Err(NFTError::InvalidAuthority.into());
                }
                let (authority_bytes_slice, rest) = rest.split_at(32);
                if rest.len() == 8usize {
                    let platform_fee = Self::unpack_amount(rest)?;

                    let authority_bytes = array_ref![authority_bytes_slice, 0 ,32];
                    return Ok(Self::Initialize(Initialize{
                        authority: Pubkey::new_from_array(*authority_bytes),
                        platform_fee: platform_fee,
                    }));
                }
                Err(NFTError::InvalidPlatformFee.into())
            }
            1 => {
                if rest.len() == 32usize {
                    let authority_bytes = array_ref![rest, 0 ,32];
                    return Ok(Self::ChangeAuthority(ChangeAuthority{
                        authority: Pubkey::new_from_array(*authority_bytes),
                    }));
                }
                Err(NFTError::InvalidAuthority.into())
            }
            2 => {
                if rest.len() == 8usize {
                    return Ok(Self::ChangeFee(ChangeFee{
                        platform_fee: Self::unpack_amount(rest)?,
                    }));
                }
                return Err(NFTError::InvalidInstructionData.into());
            }
            3 => {
                if rest.len() == 8usize {
                    return Ok(Self::List(List{
                        amount: Self::unpack_amount(rest)?,
                    }));
                }
                return Err(NFTError::InvalidInstructionData.into());
            }
            4 => {
                Ok(Self::DeList(DeList{}))
            }
            5 => {
                if rest.len() == 8usize {
                    return Ok(Self::Bid(Bid{
                        amount: Self::unpack_amount(rest)?,
                    }));
                }
                return Err(NFTError::InvalidInstructionData.into());
            }
            6 => {
                Ok(Self::WithdrawBid(WithdrawBid{}))
            }
            7 => {
                Ok(Self::AcceptBid(AcceptBid{}))
            }
            8 => {
                Ok(Self::WithdrawNFTOnSuccess(WithdrawNFTOnSuccess{}))
            }
            9 => {
                Ok(Self::RefundUser(RefundUser{}))
            }
            _ => Err(NFTError::InvalidInstruction.into()),
        }
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        let amount = input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_be_bytes)
            .ok_or(NFTError::FailedToUnpackU64)?;
        Ok(amount)
    }
}