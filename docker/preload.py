from InstructorEmbedding import INSTRUCTOR

print("Downloading model...")
model = INSTRUCTOR("hkunlp/instructor-xl")
model.encode(["Warm-up input"], [["Instruction for warm-up"]])
print("Model downloaded and warmed up!")
