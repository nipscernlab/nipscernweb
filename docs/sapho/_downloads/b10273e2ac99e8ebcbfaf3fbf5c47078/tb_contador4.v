`timescale 1ns/1ps

module tb_contador4;
    reg clk = 1'b0;
    reg rst = 1'b1;
    reg enable = 1'b0;
    wire [3:0] valor;

    contador4 dut (
        .clk(clk),
        .rst(rst),
        .enable(enable),
        .valor(valor)
    );

    always #5 clk = ~clk;

    initial begin
        $dumpfile("tb_contador4.vcd");
        $dumpvars(0, tb_contador4);

        repeat (2) @(posedge clk);
        @(negedge clk);
        rst = 1'b0;
        enable = 1'b1;

        repeat (4) @(posedge clk);
        #1;
        if (valor !== 4'd4) begin
            $display("ERRO: esperado=4 obtido=%0d", valor);
            $fatal(1);
        end

        @(negedge clk);
        enable = 1'b0;
        repeat (2) @(posedge clk);
        #1;
        if (valor !== 4'd4) begin
            $display("ERRO: contador mudou com enable=0. obtido=%0d", valor);
            $fatal(1);
        end

        $display("SUCESSO: reset, contagem e enable validados.");
        $finish;
    end
endmodule
