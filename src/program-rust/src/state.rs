use solana_program::{
    program_pack::{IsInitialized, Pack, Sealed},
    program_error::ProgramError,
    pubkey::Pubkey,
};

use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};

pub const STATESIZE: usize = 49usize;
pub const LISTESCROWSTATE: usize = 105usize;
pub const BIDESCROWSTATE: usize = 72usize;
// pub const LOGSIZE: usize = 73usize;

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct PlatformState {
    pub is_initialized: bool,
    pub authority: Pubkey,
    pub platform_fee: u64,
    pub nonce: u64
}

impl Sealed for PlatformState{}

impl IsInitialized for PlatformState{
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for PlatformState {
    const LEN: usize = STATESIZE;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, PlatformState::LEN];
        let (
            is_initialized,
            authority,
            platform_fee,
            nonce,
        ) = array_refs![src, 1, 32, 8, 8];
        let is_initialized = match is_initialized {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        Ok(PlatformState{
            is_initialized,
            authority: Pubkey::new_from_array(*authority),
            platform_fee: u64::from_be_bytes(*platform_fee),
            nonce: u64::from_be_bytes(*nonce)
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, PlatformState::LEN];
        let (
            is_initialized_dst,
            authority_dst,
            platform_fee_dst,
            nonce_dst,
        ) = mut_array_refs![dst, 1, 32, 8, 8];

        let PlatformState {
            is_initialized,
            authority,
            platform_fee,
            nonce,
        } = self;

        is_initialized_dst[0] = *is_initialized as u8;
        authority_dst.copy_from_slice(authority.as_ref());
        *platform_fee_dst = platform_fee.to_be_bytes();
        *nonce_dst = nonce.to_be_bytes();
    }
}


#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct ListEscrowState {
    pub lister: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub success: bool,
    pub successful_buyer: Pubkey,
}

impl Sealed for ListEscrowState{}

impl Pack for ListEscrowState {
    const LEN: usize = LISTESCROWSTATE;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, ListEscrowState::LEN];
        let (
            lister,
            mint, 
            amount,
            success,
            successful_buyer
        ) = array_refs![src, 32, 32, 8, 1, 32];
        let success = match success {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };
        Ok(ListEscrowState{
            lister: Pubkey::new_from_array(*lister),
            mint: Pubkey::new_from_array(*mint),
            amount: u64::from_be_bytes(*amount),
            success: success,
            successful_buyer: Pubkey::new_from_array(*successful_buyer),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, ListEscrowState::LEN];
        let (
            lister_dst,
            mint_dst,
            amount_dst,
            success_dst,
            successful_buyer_dst
        ) = mut_array_refs![dst, 32, 32, 8, 1, 32];

        let ListEscrowState {
            lister,
            mint,
            amount,
            success,
            successful_buyer
        } = self;

        lister_dst.copy_from_slice(lister.as_ref());
        mint_dst.copy_from_slice(mint.as_ref());
        *amount_dst = amount.to_be_bytes();
        success_dst[0] = *success as u8;
        successful_buyer_dst.copy_from_slice(successful_buyer.as_ref());
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BidEscrowState {
    pub bidder: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

impl Sealed for BidEscrowState{}

impl Pack for BidEscrowState {
    const LEN: usize = BIDESCROWSTATE;
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, BidEscrowState::LEN];
        let (
            bidder,
            mint, 
            amount,
        ) = array_refs![src, 32, 32, 8];
        Ok(BidEscrowState{
            bidder: Pubkey::new_from_array(*bidder),
            mint: Pubkey::new_from_array(*mint),
            amount: u64::from_be_bytes(*amount),
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, BidEscrowState::LEN];
        let (
            bidder_dst,
            mint_dst,
            amount_dst,
        ) = mut_array_refs![dst, 32, 32, 8];

        let BidEscrowState {
            bidder,
            mint,
            amount,
        } = self;

        bidder_dst.copy_from_slice(bidder.as_ref());
        mint_dst.copy_from_slice(mint.as_ref());
        *amount_dst = amount.to_be_bytes();
    }
}


// #[repr(C)]
// #[derive(Clone, Copy, Debug, Default, PartialEq)]
// pub struct UserActionLog {
//     pub action: u8,
//     pub user: Pubkey,
//     pub mint: Pubkey,
//     pub amount: u64
// }

// impl Sealed for UserActionLog{}

// impl Pack for UserActionLog {
//     const LEN: usize = LOGSIZE;
//     fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
//         let src = array_ref![src, 0, UserActionLog::LEN];
//         let (
//             action,
//             user,
//             mint, 
//             amount
//         ) = array_refs![src, 1, 32, 32, 8];
//         Ok(UserActionLog{
//             action: action[0],
//             user: Pubkey::new_from_array(*user),
//             mint: Pubkey::new_from_array(*mint),
//             amount: u64::from_be_bytes(*amount),
//         })
//     }

//     fn pack_into_slice(&self, dst: &mut [u8]) {
//         let dst = array_mut_ref![dst, 0, UserActionLog::LEN];
//         let (
//             action_dst,
//             user_dst,
//             mint_dst,
//             amount_dst
//         ) = mut_array_refs![dst, 1, 32, 32, 8];

//         let UserActionLog {
//             action,
//             user,
//             mint,
//             amount
//         } = self;


//         action_dst[0] = *action;
//         user_dst.copy_from_slice(user.as_ref());
//         mint_dst.copy_from_slice(mint.as_ref());
//         *amount_dst = amount.to_be_bytes();
//     }
// }

// #[cfg(test)]
// mod tests {
//     use super::*;
//     use rand::RngCore;

//     fn rand_bytes(n: usize) -> Vec<u8> {
//         let mut output = vec![0u8; n];
//         rand::thread_rng().fill_bytes(output.as_mut_slice());
//         output
//     }

//     #[test]
//     fn test_burn_log_pack() {
//         let amount = rand_bytes(32);
//         let mut amount_arr = [0u8; 32];
//         amount_arr.copy_from_slice(amount.as_slice());
//         let recipient = rand_bytes(25);
//         let mut recipient_arr = [0u8; DESTINATION_CHAIN_ADDRESS_LEN];
//         recipient_arr[0..25].copy_from_slice(recipient.as_slice());
//         let burn_log = BurnAndReleaseLog {
//             amount: U256::from_big_endian(amount.as_slice()),
//             recipient: recipient_arr,
//         };
//         let mut burn_log_bytes = [0u8; 64];
//         let res = BurnAndReleaseLog::pack(burn_log, &mut burn_log_bytes);
//         assert!(res.is_ok());
//     }
// }