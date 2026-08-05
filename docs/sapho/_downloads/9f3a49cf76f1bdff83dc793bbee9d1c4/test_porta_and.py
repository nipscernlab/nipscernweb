# aurora-toplevel: porta_and

import cocotb
from cocotb.triggers import Timer


async def verificar(dut, valor_a, valor_b, esperado):
    dut.a.value = valor_a
    dut.b.value = valor_b
    await Timer(1, unit="ns")

    obtido = int(dut.y.value)
    assert obtido == esperado, (
        f"a={valor_a} b={valor_b}: esperado={esperado}, obtido={obtido}"
    )


@cocotb.test()
async def testa_tabela_verdade(dut):
    casos = [
        (0, 0, 0),
        (0, 1, 0),
        (1, 0, 0),
        (1, 1, 1),
    ]

    for valor_a, valor_b, esperado in casos:
        await verificar(dut, valor_a, valor_b, esperado)
