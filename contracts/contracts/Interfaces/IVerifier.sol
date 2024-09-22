// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

struct G1Point {
    uint X;
    uint Y;
}
// Encoding of field elements is: X[0] * z + X[1]
struct G2Point {
    uint[2] X;
    uint[2] Y;
}

struct Proof {
    G1Point a;
    G2Point b;
    G1Point c;
}

interface IVerifier {
    function verifyTx(
        Proof memory proof,
        uint[2] memory input
    ) external pure returns (bool r);
}
