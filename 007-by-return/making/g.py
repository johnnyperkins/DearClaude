import chess, sys
def num(b, m):
    f=lambda s: f"{chess.square_file(s)+1}{chess.square_rank(s)+1}"
    return f(m.from_square)+f(m.to_square)+(str({5:1,4:2,3:3,2:4}[m.promotion]) if m.promotion else "")
san = sys.argv[1].split()
b = chess.Board()
for i,s in enumerate(san):
    mv = b.parse_san(s)
    n = num(b,mv)
    print(f"{i//2+1}{'.' if i%2==0 else '...'}{s:7} {n}")
    b.push(mv)
print(b); print(b.fen()); print("mate" if b.is_checkmate() else "")
