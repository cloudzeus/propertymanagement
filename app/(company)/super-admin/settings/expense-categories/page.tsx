import { listExpenseCategories } from "@/app/actions/expense-categories";
import { ExpenseCategoriesClient } from "./expense-categories-client";

export default async function ExpenseCategoriesPage() {
  const categories = await listExpenseCategories();
  return <ExpenseCategoriesClient initial={categories} />;
}
