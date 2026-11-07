import chess, sys
b = chess.Board()
for s in sys.argv[1].split(): b.push_san(s)
N = int(sys.argv[2])
def wmoves(b):
    ks=[w for w in b.legal_moves if b.piece_type_at(w.from_square)==chess.KING]
    return ks
def black(b,n,line):
    for m in list(b.legal_moves):
        s=b.san(m); b.push(m)
        if b.is_checkmate(): yield line+[s]
        elif n>1 and not b.is_game_over(): yield from white(b,n-1,line+[s])
        b.pop()
def white(b,n,line):
    for w in wmoves(b):
        s=b.san(w); b.push(w); yield from black(b,n,line+[s]); b.pop()
seen=0
for l in white(b,N,[]):
    print(" ".join(l)); seen+=1
    if seen>30: break
