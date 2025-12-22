use solana_client::rpc_request::Address;

#[test]
fn test_solana_rpc_pool_proxy() {
    let address = Address::from_str_const("GQFJibdqFGdNXm5PKvm4MmEDgNXHP1JcXNonedi2Z7kT");
    let rpc = solana_client::rpc_client::RpcClient::new("https://rpcpool.rhiva.fun/");
    let balance = rpc.get_balance(&address).unwrap();
    print!("balance={}", balance);
}
