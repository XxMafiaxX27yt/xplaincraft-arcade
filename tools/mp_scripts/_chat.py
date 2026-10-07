# In-game party chat check (run with MP_SCRIPT=tools/mp_scripts/_chat.py on any party game):
# B opens the chat in the game bar and sends a message; A must get a bubble + unread badge, then open it and reply.
A.wait_for_timeout(1500)
print('chat buttons', A.locator('[data-gchat]').count(), B.locator('[data-gchat]').count())
B.click('[data-gchat]'); B.wait_for_timeout(300)
B.fill('.gc-panel [data-msg]', 'hello from inside the game'); B.keyboard.press('Enter'); B.wait_for_timeout(1500)
print('A bubbles', A.locator('.gc-bubble').all_inner_texts(), '| badge', A.locator('[data-gchat] .pd-dot').all_inner_texts())
A.screenshot(path=os.path.join(OUT, 'chat_A_bubble.png'))
A.click('[data-gchat]'); A.wait_for_timeout(300)
A.fill('.gc-panel [data-msg]', 'got it'); A.keyboard.press('Enter'); A.wait_for_timeout(1500)
print('B panel', B.locator('.gc-panel [data-chat]').inner_text().replace('\n', ' | '))
B.screenshot(path=os.path.join(OUT, 'chat_B_panel.png'))
B.click('.gc-panel [data-close]'); B.wait_for_timeout(300)
print('B panel closed', B.locator('.gc-panel').count() == 0, '| focus on game', B.evaluate("document.activeElement && document.activeElement.className"))
