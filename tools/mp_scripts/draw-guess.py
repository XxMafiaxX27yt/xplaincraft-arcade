# Draw & Guess: whoever draws first picks a word and draws shapes; the other one guesses wrong, then sees the drawing.
def frameK(page, expr):
    return page.evaluate("(e) => document.querySelector('.gl-frame').contentWindow.eval(e)", expr)

A.wait_for_timeout(1500)
drawer, guesser = (A, B) if frameK(A, "K.net.index") == 0 else (B, A)
game_click(drawer, 200, 280)            # first word
drawer.wait_for_timeout(500)
game_click(drawer, 20 + 4 * 42 + 19, 445)   # box tool
game_click(drawer, 20 + 2 * 28 + 12, 481)   # red
game_drag(drawer, [(100, 100), (250, 220)])
game_click(drawer, 20 + 1 * 42 + 19, 445)   # rainbow pen
game_drag(drawer, [(300, 300), (360, 260), (420, 320), (480, 260), (540, 320)])
game_click(drawer, 20 + 8 * 42 + 19, 445)   # bucket
game_click(drawer, 20 + 4 * 28 + 12, 481)   # green
game_click(drawer, 170, 160)                # fill the box
drawer.wait_for_timeout(1200)
guesser.keyboard.type('notit', delay=40); guesser.keyboard.press('Enter')
guesser.wait_for_timeout(1500)
