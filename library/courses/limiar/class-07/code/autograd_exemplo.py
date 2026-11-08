"""Aula 7: o autograd do PyTorch refaz a conta da aula 4, sem nenhuma derivada escrita à mão.

Rode, a partir da raiz do repositório:
    python aulas/07-pytorch/codigo/autograd_exemplo.py

A rede é a do exemplo da aula 4, com os mesmos números: duas camadas com a tanh,
uma saída linear e a perda L = (y − t)². Na aula 4, o gradiente da perda em
relação à entrada saiu da regra da cadeia, como produto de Jacobianos, de trás
para a frente: (1,0940; −4,6074). Aqui, o PyTorch faz a passada para a frente,
guarda cada conta, e loss.backward() faz a de trás para a frente sozinho.

Resultado: L = 0,9766 e o gradiente (1,0940; −4,6074), igual ao da aula 4 até o
último algarismo: a diferença sai zero, porque as duas fazem as mesmas contas,
na mesma ordem, em float64.
"""
import sys
from pathlib import Path

import numpy as np
import torch

AULA4 = Path(__file__).resolve().parents[2] / "04-jacobiano" / "codigo"
sys.path.insert(0, str(AULA4))
from jacobiano import B1, B2, C, T, V, W1, W2, X0, gradiente_pela_cadeia, perda  # noqa: E402


def tensor(a):
    """Um array do NumPy como tensor do PyTorch, em float64, a mesma precisão do NumPy."""
    return torch.tensor(a, dtype=torch.float64)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    # requires_grad=True pede ao PyTorch que guarde as contas feitas com x, para
    # depois calcular a derivada da perda em relação a ele
    x = tensor(X0).requires_grad_(True)
    h1 = torch.tanh(tensor(W1) @ x + tensor(B1))     # a camada 1
    h2 = torch.tanh(tensor(W2) @ h1 + tensor(B2))    # a camada 2
    y = tensor(V) @ h2 + C                           # a saída, linear
    L = (y - T) ** 2                                 # a perda de um exemplo
    L.backward()                                     # a retropropagação, feita pelo PyTorch
    da_aula4 = gradiente_pela_cadeia(X0)
    print(f"L = {L.item():.4f}   (aula 4: {perda(X0):.4f})")
    print("gradiente pelo autograd:", np.round(x.grad.numpy(), 4))
    print("gradiente da aula 4:    ", np.round(da_aula4, 4))
    print(f"maior diferença: {np.abs(x.grad.numpy() - da_aula4).max():.1e}")
