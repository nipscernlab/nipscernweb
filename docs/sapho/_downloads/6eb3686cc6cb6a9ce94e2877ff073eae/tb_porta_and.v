`timescale 1ns/1ps

module tb_porta_and;
    reg a;
    reg b;
    wire y;

    porta_and dut (
        .a(a),
        .b(b),
        .y(y)
    );

    task verificar;
        input valor_a;
        input valor_b;
        input esperado;
        begin
            a = valor_a;
            b = valor_b;
            #1;

            if (y !== esperado) begin
                $display(
                    "ERRO: a=%0b b=%0b esperado=%0b obtido=%0b",
                    a, b, esperado, y
                );
                $fatal(1);
            end
        end
    endtask

    initial begin
        $dumpfile("tb_porta_and.vcd");
        $dumpvars(0, tb_porta_and);

        verificar(1'b0, 1'b0, 1'b0);
        verificar(1'b0, 1'b1, 1'b0);
        verificar(1'b1, 1'b0, 1'b0);
        verificar(1'b1, 1'b1, 1'b1);

        $display("SUCESSO: tabela verdade validada.");
        $finish;
    end
endmodule
