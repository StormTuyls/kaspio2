import { Router, Request, Response } from "express";

const router = Router();

// In-memory storage (replace with database later)
interface Todo {
  id: string;
  task: string;
  completed: boolean;
}

let todos: Todo[] = [];

// GET all todos
router.get("/", (req: Request, res: Response) => {
  res.json(todos);
});

// POST a new todo
router.post("/", (req: Request, res: Response) => {
  const newTodo: Todo = {
    id: Date.now().toString(),
    task: req.body.task,
    completed: false,
  };
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

// PUT update a todo (mark as completed)
router.put("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const todo = todos.find((t) => t.id === id);

  if (!todo) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  todo.completed = req.body.completed ?? todo.completed;
  res.json(todo);
});

// DELETE a todo
router.delete("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLength = todos.length;
  todos = todos.filter((todo) => todo.id !== id);

  if (todos.length === initialLength) {
    res.status(404).json({ error: "Todo not found" });
    return;
  }

  res.status(204).send();
});

export default router;
