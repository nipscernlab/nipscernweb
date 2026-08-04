# aurora-toplevel: sequencia_quadrados

import cocotb
from cocotb.clock import Clock
from cocotb.triggers import FallingEdge, ReadOnly, RisingEdge


@cocotb.test()
async def testa_sequencia_e_termino(dut):
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())

    dut.rst.value = 1
    for _ in range(2):
        await RisingEdge(dut.clk)
    await FallingEdge(dut.clk)
    dut.rst.value = 0

    saidas = []
    ciclos_apos_termino = 0
    for _ in range(400):
        await FallingEdge(dut.clk)
        await ReadOnly()

        if int(dut.out_en.value) == 1:
            saidas.append(int(dut.out.value))

        if int(dut.cheguei.value) == 1 and ciclos_apos_termino == 0:
            ciclos_apos_termino = 1
        elif ciclos_apos_termino:
            ciclos_apos_termino += 1

        if ciclos_apos_termino >= 3:
            break
    else:
        raise AssertionError("Tempo limite antes de o algoritmo atingir #TOAQUI.")

    assert saidas == [0, 1, 4, 9], (
        f"Esperado [0, 1, 4, 9] na porta 0, obtido {saidas}."
    )
