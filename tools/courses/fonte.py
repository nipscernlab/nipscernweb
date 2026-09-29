"""O repositório do curso, lido de um commit, sem tocar no clone.

O curso mora num repositório à parte, privado, e o clone local pode estar atrás
do remoto ou ter trabalho por commitar. Nada disso pode vazar para o site: o que
se publica é o que está no ref pedido, por padrão origin/main. Por isso a
leitura é por `git archive` desse commit, direto para a memória, e o clone só
recebe um `git fetch`, que atualiza as referências remotas e não mexe no
working tree, no índice nem no branch de ninguém.
"""
import io
import subprocess
import tarfile


def _git(repo, *args, entrada=None):
    r = subprocess.run(["git", "-C", str(repo), *args], input=entrada, capture_output=True)
    if r.returncode != 0:
        raise SystemExit(f"git {' '.join(args)} falhou em {repo}:\n{r.stderr.decode('utf-8', 'replace')}")
    return r.stdout


class Fonte:
    """Os arquivos de um commit do repositório do curso, em memória."""

    def __init__(self, repo, ref="origin/main", buscar=True):
        self.repo = repo
        if buscar:
            _git(repo, "fetch", "--quiet", "origin")
        self.sha = _git(repo, "rev-parse", ref).decode().strip()
        self.ref = ref
        # A data do commit, e não a de hoje, é a lastmod do sitemap: rodar a
        # ferramenta de novo sobre o mesmo commit tem de dar os mesmos bytes.
        self.data = _git(repo, "show", "-s", "--format=%cs", self.sha).decode().strip()
        pacote = _git(repo, "archive", "--format=tar", self.sha)
        self.arquivos = {}
        with tarfile.open(fileobj=io.BytesIO(pacote)) as tar:
            for membro in tar.getmembers():
                if membro.isfile():
                    self.arquivos[membro.name] = tar.extractfile(membro).read()

    def existe(self, caminho):
        return caminho in self.arquivos

    def ler(self, caminho):
        try:
            return self.arquivos[caminho]
        except KeyError:
            raise SystemExit(f"{caminho} não existe em {self.ref} ({self.sha[:10]}) do repositório do curso")

    def texto(self, caminho):
        # O repositório do curso é escrito no Windows e alguns arquivos chegam
        # com CRLF; tudo o que é texto passa a LF aqui, uma vez.
        return self.ler(caminho).decode("utf-8").replace("\r\n", "\n")

    def lista(self, prefixo):
        """Os arquivos logo abaixo de `prefixo`, sem descer em subpastas."""
        prefixo = prefixo.rstrip("/") + "/"
        return sorted(c for c in self.arquivos if c.startswith(prefixo) and "/" not in c[len(prefixo):])
