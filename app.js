const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const list = document.getElementById('todo-list');
const itemsLeft = document.getElementById('items-left');
const clearBtn = document.getElementById('clear-completed');

let todos = JSON.parse(localStorage.getItem('todos') || '[]');

function save() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function render() {
  list.innerHTML = '';
  todos.forEach((todo, i) => {
    const li = document.createElement('li');
    if (todo.completed) li.classList.add('completed');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggle(i));

    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Delete');
    del.addEventListener('click', () => remove(i));

    li.append(checkbox, span, del);
    list.appendChild(li);
  });

  const remaining = todos.filter(t => !t.completed).length;
  itemsLeft.textContent = `${remaining} item${remaining !== 1 ? 's' : ''} left`;
}

function add(text) {
  todos.push({ text, completed: false });
  save();
  render();
}

function toggle(index) {
  todos[index].completed = !todos[index].completed;
  save();
  render();
}

function remove(index) {
  todos.splice(index, 1);
  save();
  render();
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const text = input.value.trim();
  if (text) {
    add(text);
    input.value = '';
  }
});

clearBtn.addEventListener('click', () => {
  todos = todos.filter(t => !t.completed);
  save();
  render();
});

render();
