import io

p = "scripts/verificar-planilha.ts"
s = io.open(p, encoding="utf-8").read()

# 1) Força UTF-8 na saída do PowerShell: sem isso o pipe para o Node usa a
#    codepage do console e corrompe os acentos lidos do zip.
s = s.replace(
    '''     `Add-Type -AssemblyName System.IO.Compression.FileSystem; ${comando}`],''',
    '''     "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; " +
     `Add-Type -AssemblyName System.IO.Compression.FileSystem; ${comando}`],''')

# 2) Troca o bloco que ainda usava tar na seção 3
inicio = s.index("let partes: string[] = [];")
fim = s.index("if (partes.length) {") + len("if (partes.length) {")
s = s[:inicio] + "const partes = listarZip(caminhoXlsx);\n{" + s[fim:]

# 3) A extração da folha também usava tar
inicio2 = s.index('  execFileSync("tar", ["-xf", "planilha.xlsx"')
fim2 = s.index('"utf8");', inicio2) + len('"utf8");')
s = s[:inicio2] + '  const folha = lerDoZip(caminhoXlsx, "xl/worksheets/sheet1.xml");' + s[fim2:]

# execFileSync ainda é usado dentro de psZip; mantém o import
io.open(p, "w", encoding="utf-8", newline="").write(s)
print("ok")
