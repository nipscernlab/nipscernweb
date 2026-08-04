# aurora-toplevel: contador4

import cocotb
from cocotb.clock import Clock
from cocotb.triggers import FallingEdge, ReadOnly, RisingEdge


async def ler_apos_borda(dut):
    await RisingEdge(dut.clk)
    await ReadOnly()
    return int(dut.valor.value)


@cocotb.test()
async def testa_reset_contagem_e_enable(dut):
    cocotb.start_soon(Clock(dut.clk, 10, unit="ns").start())

    dut.rst.value = 1
    dut.enable.value = 0
    await ler_apos_borda(dut)
    assert await ler_apos_borda(dut) == 0, "O reset nao zerou o contador."

    await FallingEdge(dut.clk)
    dut.rst.value = 0
    dut.enable.value = 1
    for esperado in range(1, 5):
        obtido = await ler_apos_borda(dut)
        assert obtido == esperado, (
            f"Contagem incorreta: esperado={esperado}, obtido={obtido}"
        )

    await FallingEdge(dut.clk)
    dut.enable.value = 0
    for _ in range(2):
        obtido = await ler_apos_borda(dut)
        assert obtido == 4, (
            f"O contador mudou com enable=0: esperado=4, obtido={obtido}"
        )
