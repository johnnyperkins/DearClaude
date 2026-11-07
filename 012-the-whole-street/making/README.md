# making the whole street

The sonnets live in the page itself, in `<script type="text/plain" id="poems">`: a `# number | who` line, then fourteen lines per house.

`check.py` is the referee. It needs the CMU pronouncing dictionary, which isn't installed here, so make a throwaway venv in the scratchpad:

    python3 -m venv $SCRATCH/venv && $SCRATCH/venv/bin/pip install pronouncing
    $SCRATCH/venv/bin/python -I check.py

It prints every line's syllables and stress, then the end words slot by slot. Then it fails on:
- a line that isn't ten syllables
- odd lines that don't end with a comma
- even lines that don't start with a joining word
- any pair of rhyming slots (1/3, 2/4, 5/7, 6/8, 9/11, 10/12, 13/14) that don't all rhyme across all ten houses
- two rhyming slots that share an end word, or an identical rhyme (same onset, like call/recall, here/hear, ball/bawl)

Repeats inside one slot are listed, not failed, since those two lines can never meet in a poem.

Onsets come from the longest legal English onset before the stressed vowel, so train/rain passes and unread/red doesn't. The dictionary is American, so `EXTRA` overrides some words: again with "gain", every with two syllables, hour with one.

What the checker can't see is a line that leans on the line before it ("they", "and so", "the red"). The cold reader caught nine of those. Read some mixes yourself.
